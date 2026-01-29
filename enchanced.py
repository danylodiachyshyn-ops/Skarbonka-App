from pyspark.sql import SparkSession, Window
from pyspark.sql.functions import (
    col, lag, lead, row_number, when, unix_timestamp, floor, lit,
    first, last, max as _max, min as _min, sum as _sum, input_file_name, regexp_extract,
    pow, sqrt
)
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.classification import RandomForestClassifier
from pyspark.ml.evaluation import BinaryClassificationEvaluator, MulticlassClassificationEvaluator
from pyspark.ml.tuning import ParamGridBuilder, CrossValidator
from pyspark.storagelevel import StorageLevel
import os
import sys
import psutil
import gc
import re
import shutil
import time

#memory monitoring 
def check_memory():
    mem = psutil.virtual_memory()
    print(f"Memory: {mem.percent}% used ({mem.used/1e9:.1f}GB/{mem.total/1e9:.1f}GB)")

#environmet setup
os.environ['PYSPARK_PYTHON'] = sys.executable
os.environ['PYSPARK_DRIVER_PYTHON'] = sys.executable
os.environ['HADOOP_HOME'] = r'C:\\hadoop'
os.environ['SPARK_LOCAL_DIRS'] = r'C:/temp/spark'

# Create checkpoint directory and clean old checkpoints
CHECKPOINT_DIR = r'C:/temp/spark-checkpoint'
if os.path.exists(CHECKPOINT_DIR):
    shutil.rmtree(CHECKPOINT_DIR)
    print(f"Old checkpoints removed")
os.makedirs(CHECKPOINT_DIR, exist_ok=True)

check_memory()

#spark config
spark = (SparkSession.builder
    .appName("RandomForest_Enhanced_Training_Fixed")
    .config("spark.sql.adaptive.enabled", "true")
    .config("spark.sql.shuffle.partitions", "400")
    .config("spark.default.parallelism", "400")
    .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
    .config("spark.driver.memory", "6g")
    .config("spark.executor.memory", "8g")
    .config("spark.executor.cores", "5")
    .config("spark.memory.fraction", "0.8")
    .config("spark.memory.storageFraction", "0.3")
    .config("spark.sql.autoBroadcastJoinThreshold", "-1")
    .config("spark.rdd.compress", "true")
    .config("spark.shuffle.compress", "true")
    .config("spark.shuffle.spill.compress", "true")
    .config("spark.ui.enabled", "true")
    .config("spark.ui.port", "4040")
    .getOrCreate())

spark.sparkContext.setLogLevel("ERROR")
spark.sparkContext.setCheckpointDir(CHECKPOINT_DIR)

#fixed, disable code generation to prevent hanging
spark.conf.set("spark.sql.codegen.wholeStage", "false")
spark.conf.set("spark.sql.codegen.factoryMode", "NO_CODEGEN")
spark.conf.set("hadoop.native.lib", "false")
spark.conf.set("spark.hadoop.fs.file.impl", "org.apache.hadoop.fs.RawLocalFileSystem")

print(f"Spark UI: {spark.sparkContext.uiWebUrl}")
check_memory()

#configuration
DATA_FOLDER = os.path.join("data", "raw")
MODEL_FOLDER = os.path.join("data", "models")
LOOKBACK = 30
LAG_INTERVALS = [1, 2, 3, 4, 5, 10, 15, 20]
CANDLE_MINUTES = 30

#hyperparameter tuning settings
ENABLE_TUNING = False  # Disabled by default to save time - set True once basic version works
TUNING_NUM_FOLDS = 3
SAVE_FEATURES_FOR_TUNING = True

os.makedirs(MODEL_FOLDER, exist_ok=True)

#reading parquet files
all_parquet_files = sorted([f for f in os.listdir(DATA_FOLDER) if f.endswith(".parquet")])
split_idx = int(len(all_parquet_files) * 0.8)
train_files = all_parquet_files[:split_idx]
test_files = all_parquet_files[split_idx:]

print(f"Total files: {len(all_parquet_files)}")
print(f"Training files: {len(train_files)}")
print(f"Test files: {len(test_files)}")

#extracting symbols from filenames
symbols = set()
for f in all_parquet_files:
    match = re.search(r'([^/\\]+)\.parquet$', f)
    if match:
        symbols.add(match.group(1))

USE_SAMPLE = True  # Set to False for full training
SAMPLE_PERCENTAGE = 0.1

if USE_SAMPLE:
    train_files = train_files[:int(len(train_files) * SAMPLE_PERCENTAGE)]
    test_files = test_files[:int(len(test_files) * SAMPLE_PERCENTAGE)]
    print(f"Using sample - Train: {len(train_files)} files, Test: {len(test_files)} files")
else:
    print(f"Using full dataset - Train: {len(train_files)} files, Test: {len(test_files)} files")

train_files_full = [os.path.join(DATA_FOLDER, f) for f in train_files]
test_files_full = [os.path.join(DATA_FOLDER, f) for f in test_files]

# Read data and extract symbol from filename
df_train = spark.read.parquet(*train_files_full)
df_test = spark.read.parquet(*test_files_full)

# Extract symbol from input filename
df_train = df_train.withColumn(
    "symbol",
    regexp_extract(input_file_name(), r'([^/\\]+)\.parquet$', 1)
)

df_test = df_test.withColumn(
    "symbol",
    regexp_extract(input_file_name(), r'([^/\\]+)\.parquet$', 1)
)

check_memory()
gc.collect()

# --- 30-minute aggregation (per symbol) ---
print("aggregating")

def aggregate_candles(df):
    df = df.withColumn(
        "time_bucket",
        floor(unix_timestamp(col("open_time")) * 1000 / lit(CANDLE_MINUTES*60*1000)) * lit(CANDLE_MINUTES*60*1000)
    )
    
    df = df.groupBy("symbol", "time_bucket").agg(
        first("open").alias("open"),
        _max("high").alias("high"),
        _min("low").alias("low"),
        last("close").alias("close"),
        _sum("volume").alias("volume"),
        _sum("number_of_trades").alias("number_of_trades"),
        _sum("taker_buy_base_asset_volume").alias("taker_buy_base_asset_volume"),
        _sum("taker_buy_quote_asset_volume").alias("taker_buy_quote_asset_volume")
    ).withColumnRenamed("time_bucket", "open_time").orderBy("symbol", "open_time")
    
    return df

df_train = aggregate_candles(df_train)
df_test = aggregate_candles(df_test)

#checkpoint to break lineage
df_train = df_train.checkpoint()
df_test = df_test.checkpoint()
check_memory()
gc.collect()

#feature engineering
BASE_COLUMNS = [
    "open", "high", "low", "close", "volume", "number_of_trades",
    "taker_buy_base_asset_volume", "taker_buy_quote_asset_volume"
]

def generate_features(df, dataset_name=""):
    print(f"feauture generation")
    
    window_spec = Window.partitionBy("symbol").orderBy("open_time")
    
    #lag features
    print("lag features")
    lag_expressions = []
    for i in LAG_INTERVALS:
        for c in BASE_COLUMNS:
            lag_expressions.append(lag(col(c), i).over(window_spec).alias(f"{c}_lag{i}"))
    
    original_cols = [col(c) for c in df.columns]
    df = df.select(*original_cols, *lag_expressions)
    
    print("checkpoint after lag")
    df = df.checkpoint()
    check_memory()
    gc.collect()
    
    #label
    print("label")
    df = df.withColumn("close_next", lead(col("close"), 1).over(window_spec))
    df = df.withColumn("label",
        when(col("close_next") > col("close"), 1)
        .when(col("close_next") < col("close"), 0)
        .otherwise(0)
    )
    df = df.drop("close_next")
    
    #derived
    print("derived features")
    df = df.withColumn("body", col("close") - col("open"))
    df = df.withColumn("range", col("high") - col("low"))
    df = df.withColumn("upper_wick", col("high") - when(col("close") > col("open"), col("close")).otherwise(col("open")))
    df = df.withColumn("lower_wick", when(col("close") < col("open"), col("close")).otherwise(col("open")) - col("low"))
    
    #returns
    for i in LAG_INTERVALS[:-1]:
        next_lag = LAG_INTERVALS[LAG_INTERVALS.index(i) + 1] if LAG_INTERVALS.index(i) + 1 < len(LAG_INTERVALS) else i + 1
        df = df.withColumn(f"return_lag{i}", 
            when(col(f"close_lag{next_lag}") != 0,
                 (col(f"close_lag{i}") - col(f"close_lag{next_lag}")) / col(f"close_lag{next_lag}"))
            .otherwise(0))
    
    #technical
    #moving averages 
    df = df.withColumn("sma_5", 
        (col("close_lag1") + col("close_lag2") + col("close_lag3") + col("close_lag5") + col("close_lag4")) / 5)
    
    df = df.withColumn("price_to_sma5", 
        when(col("sma_5") != 0, (col("close") - col("sma_5")) / col("sma_5")).otherwise(0))
    
    #RSI (simplified)
    for i in [1, 2, 3]:
        df = df.withColumn(f"gain_{i}", when(col(f"return_lag{i}") > 0, col(f"return_lag{i}")).otherwise(0))
        df = df.withColumn(f"loss_{i}", when(col(f"return_lag{i}") < 0, -col(f"return_lag{i}")).otherwise(0))
    
    df = df.withColumn("avg_gain", (col("gain_1") + col("gain_2") + col("gain_3")) / 3)
    df = df.withColumn("avg_loss", (col("loss_1") + col("loss_2") + col("loss_3")) / 3)
    
    df = df.withColumn("rsi",
        when(col("avg_loss") != 0, 100 - (100 / (1 + (col("avg_gain") / col("avg_loss"))))).otherwise(50))
    
    #volatility
    df = df.withColumn("volatility",
        sqrt((pow(col("return_lag1"), 2) + pow(col("return_lag2"), 2) + pow(col("return_lag3"), 2)) / 3))
    
    #volume
    df = df.withColumn("volume_ratio", when(col("volume_lag1") != 0, col("volume") / col("volume_lag1")).otherwise(0))
    
    df = df.withColumn("volume_sma_3",
        (col("volume_lag1") + col("volume_lag2") + col("volume_lag3")) / 3)
    
    df = df.withColumn("volume_deviation",
        when(col("volume_sma_3") != 0, (col("volume") - col("volume_sma_3")) / col("volume_sma_3")).otherwise(0))
    
    #momentum
    df = df.withColumn("price_momentum", 
        when(col("close_lag5") != 0, (col("close") - col("close_lag5")) / col("close_lag5")).otherwise(0))
    
    df = df.withColumn("volume_momentum", 
        when(col("volume_lag5") != 0, (col("volume") - col("volume_lag5")) / col("volume_lag5")).otherwise(0))
    
    #order flow
    df = df.withColumn("taker_buy_ratio",
        when(col("volume") != 0, col("taker_buy_base_asset_volume") / col("volume")).otherwise(0))
    
    df = df.withColumn("buy_pressure_lag1",
        when(col("volume_lag1") != 0, col("taker_buy_base_asset_volume_lag1") / col("volume_lag1")).otherwise(0))
    
    df = df.withColumn("buy_pressure_change",
        col("taker_buy_ratio") - col("buy_pressure_lag1"))

    df = df.dropna()
    check_memory()
    gc.collect()

    #assemble features
    print("assembling")
    FEATURE_COLUMNS = []
    
    #lag features
    for i in LAG_INTERVALS:
        for c in BASE_COLUMNS:
            FEATURE_COLUMNS.append(f"{c}_lag{i}")
    
    #basic derived
    FEATURE_COLUMNS += ["body", "range", "upper_wick", "lower_wick"]
    
    #returns
    for i in LAG_INTERVALS[:-1]:
        FEATURE_COLUMNS.append(f"return_lag{i}")
    
    #technical 
    FEATURE_COLUMNS += [
        "sma_5", "price_to_sma5", "rsi", "volatility",
        "volume_ratio", "volume_deviation",
        "price_momentum", "volume_momentum",
        "taker_buy_ratio", "buy_pressure_change"
    ]

    #dropping intemidiate columns
    columns_to_drop = [
        "gain_1", "loss_1", "gain_2", "loss_2", "gain_3", "loss_3",
        "avg_gain", "avg_loss", "buy_pressure_lag1", "volume_sma_3"
    ]
    for col_name in columns_to_drop:
        if col_name in df.columns:
            df = df.drop(col_name)

    assembler = VectorAssembler(inputCols=FEATURE_COLUMNS, outputCol="features", handleInvalid="skip")
    
    df = assembler.transform(df)

    result_df = df.select("symbol", "features", "label")
    
    return result_df, FEATURE_COLUMNS

# Generate features for train and test
df_train_features, FEATURE_COLUMNS = generate_features(df_train, "TRAINING")
df_test_features, _ = generate_features(df_test, "TEST")

# Checkpoint before training
print("Checkpointing feature dataset")

start_time = time.time()

df_train_features = df_train_features.checkpoint()

if SAVE_FEATURES_FOR_TUNING:
    print("Saving training features for hyperparameter tuning.")
    df_train_features.write.mode("overwrite").parquet("data/cache/train_features.parquet")
    print("saved to data/cache/train_features.parquet")
start_time = time.time()
df_test_features = df_test_features.checkpoint()
print(f"✓ Test features checkpointed ({(time.time()-start_time)/60:.1f} min)")

check_memory()
gc.collect()

print("Handling class imbalance")

label_counts = df_train_features.groupBy("label").count().collect()
label_dict = {row['label']: row['count'] for row in label_counts}

count_0 = label_dict.get(0, 0)
count_1 = label_dict.get(1, 0)
total = count_0 + count_1

print(f"DOWN (0): {count_0:,} ({count_0/total*100:.2f}%)")
print(f"UP (1): {count_1:,} ({count_1/total*100:.2f}%)")

if count_0 > 0 and count_1 > 0:
    weight_0 = total / (2.0 * count_0)
    weight_1 = total / (2.0 * count_1)
    
    print(f"\nClass weights:")
    print(f"DOWN (0): {weight_0:.4f}")
    print(f"UP (1): {weight_1:.4f}")
    
    df_train_features = df_train_features.withColumn(
        "weight",
        when(col("label") == 0, lit(weight_0))
        .when(col("label") == 1, lit(weight_1))
        .otherwise(lit(1.0))
    )
    use_weights = True
else:
    use_weights = False

#actual training
print('model training')

if ENABLE_TUNING:
    print("Hyperparameter tuning ENABLED (1-3 hours)")
    # ... tuning code ...
else:
    print("Hyperparameter tuning DISABLED")
    print("Using tuned parameters")
    
    rf = RandomForestClassifier(
        featuresCol="features",
        labelCol="label",
        weightCol="weight" if use_weights else None,
        numTrees=50,
        maxDepth=8,
        maxBins= 24,
        subsamplingRate= 0.7,
        seed=42,
        probabilityCol="probability",
        rawPredictionCol="rawPrediction"
    )
    
    print("training the base learner")
    start_time = time.time()
    check_memory()
    
    rf_model = rf.fit(df_train_features.select("features", "label", "weight") if use_weights 
                      else df_train_features.select("features", "label"))
    
    print(f"trained in {(time.time()-start_time)/60:.1f} minutes")
    check_memory()

#saving model
model_path = os.path.join(MODEL_FOLDER, "rf_enhanced_model").replace("\\", "/")
rf_model.write().overwrite().save(model_path)
print(f"Model saved to {model_path}")

# Feature importance
print("feature importance")
feature_importances = rf_model.featureImportances
importances = [(FEATURE_COLUMNS[i], float(feature_importances[i])) for i in range(len(FEATURE_COLUMNS))]
importances.sort(key=lambda x: x[1], reverse=True)

for feat, imp in importances[:]:
    print(f"{feat:<35} {imp:.4f}")

#evaluation
print("Evaluation on test")

predictions = rf_model.transform(df_test_features.select("symbol", "features", "label"))
predictions = predictions.checkpoint()

predictions.select("symbol", "label", "prediction", "probability").show(10, truncate=False)

# Metrics
accuracy_evaluator = MulticlassClassificationEvaluator(labelCol="label", predictionCol="prediction", metricName="accuracy")
auc_evaluator = BinaryClassificationEvaluator(labelCol="label", rawPredictionCol="rawPrediction", metricName="areaUnderROC")
f1_evaluator = MulticlassClassificationEvaluator(labelCol="label", predictionCol="prediction", metricName="f1")

accuracy = accuracy_evaluator.evaluate(predictions)
auc = auc_evaluator.evaluate(predictions)
f1 = f1_evaluator.evaluate(predictions)

print(f"\nAccuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
print(f"AUC-ROC: {auc:.4f}")
print(f"F1 Score: {f1:.4f}")

predictions.groupBy("label", "prediction").count().orderBy("label", "prediction").show()

# Per-class metrics
confusion = predictions.groupBy("label", "prediction").count().collect()
confusion_dict = {(row['label'], row['prediction']): row['count'] for row in confusion}

total_up = confusion_dict.get((1, 0), 0) + confusion_dict.get((1, 1), 0)
correct_up = confusion_dict.get((1, 1), 0)
total_down = confusion_dict.get((0, 0), 0) + confusion_dict.get((0, 1), 0)
correct_down = confusion_dict.get((0, 0), 0)

up_recall = correct_up / total_up if total_up > 0 else 0
down_recall = correct_down / total_down if total_down > 0 else 0

print(f"\nUP recall: {up_recall:.4f} ({up_recall*100:.2f}%)")
print(f"DOWN recall: {down_recall:.4f} ({down_recall*100:.2f}%)")

print("Comparison")
print(f"Baseline AUC: 0.5945")
print(f"Enhanced AUC: {auc:.4f} ({((auc - 0.5945) / 0.5945 * 100):+.2f}% change)")

print("\ntraining pipeline complete!")
check_memory()

# Cleanup
print("\nCleaning up...")
try:
    predictions.unpersist()
    df_train_features.unpersist()
    df_test_features.unpersist()
except:
    pass

spark.stop()
time.sleep(2)

try:
    shutil.rmtree(CHECKPOINT_DIR)
    print("Checkpoints cleaned")
except Exception as e:
    print(f"Warning: {e}")