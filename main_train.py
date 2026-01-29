"""Main training script for Scalable Pattern Recognition System in Cryptocurrency Markets.

This script implements a 3-level stacked generalization ensemble:
- Level 0: RandomForest models trained on batches of symbols
- Level 1: RandomForest meta-learner trained on Level 0 predictions
- Level 2: LogisticRegression final meta-model trained on Level 1 predictions
"""

import os
import sys
import math
import shutil
import psutil
import zipfile
import gc
from pathlib import Path
from typing import List, Optional

from pyspark.sql import SparkSession, functions, DataFrame
from pyspark.sql.window import Window
from pyspark.sql.functions import (
    col, lag, lead, when, sqrt, pow, lit, floor, unix_timestamp,
    struct, min as min_, max as max_, sum as sum_
)
from pyspark.ml.feature import VectorAssembler, StandardScaler
from pyspark.ml.classification import RandomForestClassifier, LogisticRegression
from pyspark.ml.evaluation import MulticlassClassificationEvaluator, BinaryClassificationEvaluator
from pyspark.ml.functions import vector_to_array

import findspark
findspark.init("/Users/diachykdiachyshyn/Desktop/spark-4.1.1-bin-hadoop3")

# Configuration
os.environ['PYSPARK_PYTHON'] = sys.executable
os.environ['PYSPARK_DRIVER_PYTHON'] = sys.executable

# Constants
LAG_INTERVALS = [1, 2, 3, 5, 8, 10, 13, 21]
BASE_COLUMNS = [
    "open", "high", "low", "close", "volume", "quote_asset_volume",
    "number_of_trades", "taker_buy_base_asset_volume", "taker_buy_quote_asset_volume"
]
MAX_FEATURES = 100
SEED = 42
LEVEL_0_BATCH_SIZE = 10
NUM_TREES = 100
MAX_DEPTH = 7
SPLIT_RATIO = 0.8
OOF_OUTPUT_PATH = "level0_oof_predictions.parquet"

# Data Configuration
# Use already-extracted Binance data directory
DATA_DIR = "/Users/diachykdiachyshyn/Desktop/Binance Pattern Recognition/archive_extracted"

# Optional: Sample data for faster testing (None = use all data, 0.1 = 10% sample)
DATA_SAMPLE_FRACTION = None  # Set to 0.1 for quick testing, None for full dataset

# Initialize Spark
spark = (SparkSession.builder
    .appName("RandomForest_Enhanced_Training_Fixed")
    .config("spark.sql.adaptive.enabled", "true")
    .config("spark.sql.shuffle.partitions", "400")
    .config("spark.default.parallelism", "400")
    .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
    .config("spark.driver.memory", "6g")
    .config("spark.executor.memory", "8g")
    .config("spark.executor.cores", "5")
    .config("spark.memory.fraction", "0.6")
    .config("spark.memory.storageFraction", "0.2")
    .config("spark.sql.autoBroadcastJoinThreshold", "-1")
    .config("spark.memory.offHeap.enabled", "true")
    .config("spark.memory.offHeap.size", "2g")
    .config("spark.sql.execution.arrow.pyspark.enabled", "false")
    .config("spark.sql.execution.arrow.maxRecordsPerBatch", "1000")
    .config("spark.rdd.compress", "true")
    .config("spark.shuffle.compress", "true")
    .config("spark.shuffle.spill.compress", "true")
    .config("spark.ui.enabled", "true")
    .config("spark.ui.port", "4040")
    .getOrCreate())

sc = spark.sparkContext

# Configure checkpoint directory on SSD for better performance
# Use /tmp which is typically on SSD, or specify custom SSD path
CHECKPOINT_DIR = "/tmp/spark_checkpoints"
os.makedirs(CHECKPOINT_DIR, exist_ok=True)
spark.sparkContext.setCheckpointDir(CHECKPOINT_DIR)
print(f"Checkpoint directory set to: {CHECKPOINT_DIR} (on SSD)")

# Force eager checkpointing (writes to disk immediately)
spark.conf.set("spark.sql.execution.arrow.maxRecordsPerBatch", "1000")


def check_memory(stage_name=""):
    """Check and print memory usage at each stage."""
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    system_mem = psutil.virtual_memory()
    
    print("\n" + "="*60)
    print(f"MEMORY CHECK - {stage_name}")
    print("="*60)
    print(f"Process Memory:")
    print(f"  RSS: {mem_info.rss / 1024 / 1024:.2f} MB")
    print(f"  VMS: {mem_info.vms / 1024 / 1024:.2f} MB")
    print(f"\nSystem Memory:")
    print(f"  Total: {system_mem.total / 1024 / 1024 / 1024:.2f} GB")
    print(f"  Available: {system_mem.available / 1024 / 1024 / 1024:.2f} GB")
    print(f"  Used: {system_mem.used / 1024 / 1024 / 1024:.2f} GB ({system_mem.percent:.1f}%)")
    print("="*60 + "\n")


def cleanup_memory():
    """Aggressively clean up memory: unpersist Spark cache and run Python GC."""
    print("Cleaning up memory...")
    
    # Clear Spark cache
    try:
        spark.catalog.clearCache()
        print("  ✓ Cleared Spark cache")
    except:
        pass
    
    # Force Python garbage collection
    collected = gc.collect()
    print(f"  ✓ Python GC collected {collected} objects")
    
    check_memory("After Memory Cleanup")


def aggregate_candles(df, interval_minutes=30):
    """Aggregate 1-minute candles into higher timeframes."""
    seconds = interval_minutes * 60
    df = df.withColumn("window_time", (floor(unix_timestamp("open_time") / seconds) * seconds).cast("timestamp"))
    
    # Checkpoint before groupBy to reduce memory pressure
    print("  Checkpointing before aggregation...")
    df = df.checkpoint()
    _ = df.count()  # Force checkpoint execution
    
    df_agg = df.groupBy("symbol", "window_time").agg(
        min_(struct("open_time", "open"))["open"].alias("open"),
        max_("high").alias("high"),
        min_("low").alias("low"),
        max_(struct("open_time", "close"))["close"].alias("close"),
        sum_("volume").alias("volume"),
        sum_("quote_asset_volume").alias("quote_asset_volume"),
        sum_("number_of_trades").alias("number_of_trades"),
        sum_("taker_buy_base_asset_volume").alias("taker_buy_base_asset_volume"),
        sum_("taker_buy_quote_asset_volume").alias("taker_buy_quote_asset_volume")
    )
    
    result = df_agg.withColumnRenamed("window_time", "open_time").orderBy("symbol", "open_time")
    
    # Checkpoint after aggregation
    print("  Checkpointing after aggregation...")
    result = result.checkpoint()
    _ = result.count()  # Force checkpoint execution
    
    return result


def get_split_threshold(df, split_column, quantile=0.8):
    """Calculate time threshold for train/test split."""
    total_rows = df.count()
    if total_rows == 0:
        return None
    
    split_index = int(total_rows * quantile)
    threshold_row = df.select(split_column) \
        .orderBy(split_column) \
        .limit(split_index) \
        .agg(functions.max(col(split_column))) \
        .collect()[0]
    
    return threshold_row[0]


def extract_zip_if_needed(data_path: str) -> str:
    """
    Extract ZIP file if data_path points to a ZIP archive.
    Returns the path to the extracted directory or original path if not a ZIP.
    
    Args:
        data_path: Path to ZIP file or directory
        
    Returns:
        Path to directory containing the data
    """
    path_obj = Path(data_path)
    
    # If it's already a directory, return it
    if path_obj.is_dir():
        return data_path
    
    # Check if it's a ZIP file
    if path_obj.is_file() and zipfile.is_zipfile(data_path):
        print(f"Detected ZIP archive: {data_path}")
        # Create extract directory with "_extracted" suffix to avoid conflicts
        extract_dir = path_obj.parent / f"{path_obj.stem}_extracted"
        
        # Check if already extracted
        if extract_dir.exists() and extract_dir.is_dir():
            print(f"Using existing extracted directory: {extract_dir}")
            return str(extract_dir)
        
        # Extract ZIP file
        print(f"Extracting ZIP to: {extract_dir}")
        print("This may take a few minutes for large archives...")
        extract_dir.mkdir(exist_ok=True)
        
        with zipfile.ZipFile(data_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        print(f"Extraction complete! Data available at: {extract_dir}")
        return str(extract_dir)
    
    # Not a ZIP file or directory, return original path (will error later if invalid)
    return data_path


def find_all_parquet_paths(data_dir: str) -> List[str]:
    """
    Find all parquet files and directories in the data directory.
    Handles both single .parquet files and parquet directories.
    
    Args:
        data_dir: Root directory containing parquet files
        
    Returns:
        List of paths (files or directories) to load
    """
    data_path = Path(data_dir)
    if not data_path.exists():
        raise ValueError(f"Data directory does not exist: {data_dir}")
    
    parquet_paths = []
    
    # Find all .parquet files
    for parquet_file in data_path.rglob("*.parquet"):
        # Skip files inside parquet directories (part-*.parquet)
        if "part-" not in parquet_file.name:
            parquet_paths.append(str(parquet_file))
    
    # Find parquet directories (containing part-*.parquet files)
    for item in data_path.rglob("*"):
        if item.is_dir():
            # Check if this directory contains parquet files
            has_parquet = any(f.suffix == ".parquet" for f in item.rglob("part-*.parquet"))
            if has_parquet:
                parquet_paths.append(str(item))
    
    # Remove duplicates and sort
    parquet_paths = sorted(list(set(parquet_paths)))
    
    return parquet_paths


def load_binance_data(spark: SparkSession, data_dir: str, sample_fraction: Optional[float] = None) -> DataFrame:
    """
    Load all Binance data from parquet files in the specified directory.
    Automatically extracts ZIP files if needed.
    
    Args:
        spark: SparkSession instance
        data_dir: Directory or ZIP file containing parquet files
        sample_fraction: Optional fraction to sample (for testing, e.g., 0.1 = 10%)
        
    Returns:
        Combined DataFrame with all data
    """
    print(f"Loading Binance data from: {data_dir}")
    
    # Extract ZIP if needed
    actual_data_dir = extract_zip_if_needed(data_dir)
    
    # Find all parquet paths
    parquet_paths = find_all_parquet_paths(actual_data_dir)
    
    if not parquet_paths:
        raise ValueError(f"No parquet files found in {data_dir}")
    
    print(f"Found {len(parquet_paths)} parquet files/directories")
    
    # Load all parquet files in batches to manage memory
    dfs = []
    load_batch_size = 20  # Load 20 files, then checkpoint
    
    for i, path in enumerate(parquet_paths, 1):
        try:
            print(f"  Loading [{i}/{len(parquet_paths)}]: {Path(path).name}")
            df = spark.read.parquet(path)
            
            # Check if symbol column exists, if not try to extract from filename
            if "symbol" not in df.columns:
                # Try to extract symbol from filename
                filename = Path(path).stem
                # Common formats: "BTCUSDT.parquet", "BTC-USDT.parquet", "BTC_USDT.parquet"
                symbol = filename.replace("-", "").replace("_", "").upper()
                if len(symbol) >= 3:  # Basic validation
                    df = df.withColumn("symbol", lit(symbol))
                    print(f"    Added symbol column: {symbol}")
            
            # Sample if requested
            if sample_fraction and sample_fraction < 1.0:
                df = df.sample(fraction=sample_fraction, seed=42)
            
            dfs.append(df)
            
            # Checkpoint after every N files to prevent memory buildup
            if len(dfs) % load_batch_size == 0:
                print(f"  Checkpointing after loading {len(dfs)} files...")
                # Combine and checkpoint current batch
                if len(dfs) == load_batch_size:
                    temp_df = dfs[0]
                    for d in dfs[1:]:
                        temp_df = temp_df.unionByName(d, allowMissingColumns=True)
                    temp_df = temp_df.checkpoint()
                    _ = temp_df.count()
                    # Clean up old DataFrames
                    for d in dfs:
                        try:
                            d.unpersist()
                        except:
                            pass
                    del dfs
                    dfs = [temp_df]  # Replace with checkpointed combined DF
                    cleanup_memory()
                    check_memory(f"After Loading Batch of {load_batch_size} files")
                    
        except Exception as e:
            print(f"    Warning: Failed to load {path}: {e}")
            continue
    
    if not dfs:
        raise ValueError("No data files could be loaded!")
    
    # Union all DataFrames in batches to reduce memory pressure
    print(f"\nCombining {len(dfs)} DataFrames...")
    combined_df = dfs[0]
    
    # Process in batches to avoid memory overflow
    batch_size = 10
    for i in range(1, len(dfs), batch_size):
        batch = dfs[i:i+batch_size]
        print(f"  Combining batch {i//batch_size + 1}/{(len(dfs)-1)//batch_size + 1} ({len(batch)} DataFrames)...")
        
        for df in batch:
            combined_df = combined_df.unionByName(df, allowMissingColumns=True)
        
        # Unpersist batch DataFrames after union
        for df in batch:
            try:
                df.unpersist()
            except:
                pass
        
        # Checkpoint after each batch to free memory
        if i + batch_size < len(dfs):  # Don't checkpoint on last batch
            print(f"  Checkpointing after batch {i//batch_size + 1}...")
            combined_df = combined_df.checkpoint()
            _ = combined_df.count()  # Force checkpoint execution
            cleanup_memory()
            check_memory(f"After Combining Batch {i//batch_size + 1}")
    
    # Clean up remaining DataFrames
    for df in dfs[1:]:
        try:
            df.unpersist()
        except:
            pass
    del dfs  # Delete list
    
    # Ensure symbol column exists
    if "symbol" not in combined_df.columns:
        print("Warning: No symbol column found. Using default 'UNKNOWN'")
        combined_df = combined_df.withColumn("symbol", lit("UNKNOWN"))
    
    # Final checkpoint after all unions
    print("Checkpointing after all DataFrames combined...")
    combined_df = combined_df.checkpoint()
    _ = combined_df.count()  # Force checkpoint execution
    check_memory("After Combining All DataFrames")
    
    print(f"Total rows loaded: {combined_df.count()}")
    print(f"Symbols found: {combined_df.select('symbol').distinct().count()}")
    combined_df.select('symbol').distinct().show(20, truncate=False)
    
    return combined_df


def generate_features(df, dataset_name=""):
    """Generate features using Window functions to prevent data leakage."""
    print(f"Feature generation started for {dataset_name}\n")
    
    # Define main window for ordering
    window_spec = Window.partitionBy("symbol").orderBy("open_time")
    
    # 1. TIME FEATURES (Crypto Seasonality)
    # Crypto markets behave differently during Asian, London, and NY sessions
    print("Creating time seasonality features...")
    df = df.withColumn("hour", functions.hour("open_time"))
    df = df.withColumn("day_of_week", functions.dayofweek("open_time"))
    
    # 2. LAG FEATURES
    print("Creating lag features...")
    lag_expressions = []
    for i in LAG_INTERVALS:
        for c in BASE_COLUMNS:
            lag_expressions.append(lag(col(c), i).over(window_spec).alias(f"{c}_lag{i}"))
    
    original_cols = [col(c) for c in df.columns]
    df = df.select(*original_cols, *lag_expressions)
    
    # Checkpoint to manage DAG size
    df = df.checkpoint() 
    
    # 3. LABEL CREATION
    print("Creating labels...")
    df = df.withColumn("close_next", lead(col("close"), 1).over(window_spec))
    df = df.withColumn("label", when(col("close_next") > col("close"), 1).otherwise(0))
    df = df.drop("close_next")

    # 4. DERIVED FEATURES (Body, Wick, Returns)
    print("Creating basic derived features...")
    df = df.withColumn("body", col("close") - col("open"))
    df = df.withColumn("range", col("high") - col("low"))
    df = df.withColumn("upper_wick", col("high") - when(col("close") > col("open"), col("close")).otherwise(col("open")))
    df = df.withColumn("lower_wick", when(col("close") < col("open"), col("close")).otherwise(col("open")) - col("low"))
    
    # Returns
    for i in LAG_INTERVALS[:-1]:
        next_lag = LAG_INTERVALS[LAG_INTERVALS.index(i) + 1] if LAG_INTERVALS.index(i) + 1 < len(LAG_INTERVALS) else i + 1
        df = df.withColumn(f"return_lag{i}", 
            when(col(f"close_lag{next_lag}") != 0,
                 (col(f"close_lag{i}") - col(f"close_lag{next_lag}")) / col(f"close_lag{next_lag}"))
            .otherwise(0))

    # 5. ADVANCED TECHNICAL INDICATORS
    print("Creating advanced technical indicators...")
    
    # Define Windows (Looking strictly at PAST data to avoid leakage)
    w_short = Window.partitionBy("symbol").orderBy("open_time").rowsBetween(-5, -1)
    w_mid   = Window.partitionBy("symbol").orderBy("open_time").rowsBetween(-20, -1)
    
    # A. TREND (SMA & Price Context)
    df = df.withColumn("sma_5", functions.avg("close").over(w_short))
    df = df.withColumn("sma_20", functions.avg("close").over(w_mid))
    
    # Price vs Short Trend (Momentum)
    df = df.withColumn("price_to_sma5", 
        when(col("sma_5") != 0, (col("close") - col("sma_5")) / col("sma_5")).otherwise(0))
    
    # Price vs Medium Trend (Mean Reversion)
    df = df.withColumn("price_to_sma20", 
        when(col("sma_20") != 0, (col("close") - col("sma_20")) / col("sma_20")).otherwise(0))

    # B. BOLLINGER BANDS (Volatility Context)
    df = df.withColumn("stddev_20", functions.stddev("close").over(w_mid))
    df = df.withColumn("upper_band", col("sma_20") + (lit(2) * col("stddev_20")))
    df = df.withColumn("lower_band", col("sma_20") - (lit(2) * col("stddev_20")))
    
    # Position: 0.0=Lower Band, 0.5=Mid, 1.0=Upper Band
    df = df.withColumn("bb_position", 
        when((col("upper_band") - col("lower_band")) != 0,
             (col("close") - col("lower_band")) / (col("upper_band") - col("lower_band")))
        .otherwise(0.5))
        
    # Bandwidth: Detects Volatility Squeezes (Low value = Big move coming)
    df = df.withColumn("bb_width",
        when(col("sma_20") != 0, (col("upper_band") - col("lower_band")) / col("sma_20")).otherwise(0))

    # C. STOCHASTIC OSCILLATOR (Momentum/Breakout)
    df = df.withColumn("rolling_low", functions.min("low").over(w_mid))
    df = df.withColumn("rolling_high", functions.max("high").over(w_mid))
    
    df = df.withColumn("stoch_k",
        when((col("rolling_high") - col("rolling_low")) != 0,
             (lit(100) * (col("close") - col("rolling_low")) / (col("rolling_high") - col("rolling_low"))))
        .otherwise(50))

    # D. MULTI-TIMEFRAME RSI (6, 14, 24)
    df = df.withColumn("price_change", col("close") - col("close_lag1"))
    df = df.withColumn("gain", when(col("price_change") > 0, col("price_change")).otherwise(0))
    df = df.withColumn("loss", when(col("price_change") < 0, -col("price_change")).otherwise(0))
    
    for period in [6, 14, 24]:
        w_rsi = Window.partitionBy("symbol").orderBy("open_time").rowsBetween(-period, -1)
        avg_gain = functions.avg("gain").over(w_rsi)
        avg_loss = functions.avg("loss").over(w_rsi)
        
        df = df.withColumn(f"rsi_{period}", 
            when(avg_loss != 0, 
                 lit(100) - (lit(100) / (lit(1) + (avg_gain / avg_loss))))
            .otherwise(lit(100)))

    # E. VOLUME & ORDER FLOW
    df = df.withColumn("volume_ratio", when(col("volume_lag1") != 0, col("volume") / col("volume_lag1")).otherwise(0))
    df = df.withColumn("volume_sma_3", (col("volume_lag1") + col("volume_lag2") + col("volume_lag3")) / 3)
    df = df.withColumn("volume_deviation", when(col("volume_sma_3") != 0, (col("volume") - col("volume_sma_3")) / col("volume_sma_3")).otherwise(0))
    
    df = df.withColumn("price_momentum", when(col("close_lag5") != 0, (col("close") - col("close_lag5")) / col("close_lag5")).otherwise(0))
    df = df.withColumn("taker_buy_ratio", when(col("volume") != 0, col("taker_buy_base_asset_volume") / col("volume")).otherwise(0))
    df = df.withColumn("buy_pressure_lag1", when(col("volume_lag1") != 0, col("taker_buy_base_asset_volume_lag1") / col("volume_lag1")).otherwise(0))
    df = df.withColumn("buy_pressure_change", col("taker_buy_ratio") - col("buy_pressure_lag1"))
    
    # Calculate simple volatility for reference
    df = df.withColumn("volatility", sqrt((pow(col("return_lag1"), 2) + pow(col("return_lag2"), 2)) / 2))

    # 6. CLEANUP & ASSEMBLY
    print("Dropping null values...")
    df = df.dropna()
    
    print("Assembling features...")
    FEATURE_COLUMNS = []
    # Add Lags
    for i in LAG_INTERVALS:
        for c in BASE_COLUMNS:
            FEATURE_COLUMNS.append(f"{c}_lag{i}")
    
    # Add Derived
    FEATURE_COLUMNS += ["body", "range", "upper_wick", "lower_wick"]
    for i in LAG_INTERVALS[:-1]:
        FEATURE_COLUMNS.append(f"return_lag{i}")
        
    # ADD NEW INDICATORS TO LIST
    FEATURE_COLUMNS += [
        "hour", "day_of_week",              # Seasonality
        "sma_5", "price_to_sma5",           # Short Trend
        "price_to_sma20",                   # Medium Trend (New)
        "bb_position", "bb_width",          # Volatility Context (New)
        "stoch_k",                          # Momentum (New)
        "rsi_6", "rsi_14", "rsi_24",        # Multi-RSI (New)
        "volatility", 
        "volume_ratio", "volume_deviation",
        "price_momentum", 
        "taker_buy_ratio", "buy_pressure_change"
    ]
    
    # Safety limit (Optional, can increase if memory allows)
    if len(FEATURE_COLUMNS) > 150:
        FEATURE_COLUMNS = FEATURE_COLUMNS[:150]
    
    # Clean up intermediate columns to save memory
    cols_to_drop = ["price_change", "gain", "loss", "upper_band", "lower_band", "rolling_high", "rolling_low", "stddev_20"]
    df = df.drop(*cols_to_drop)

    assembler = VectorAssembler(inputCols=FEATURE_COLUMNS, outputCol="features", handleInvalid="skip")
    df = assembler.transform(df)
    
    return df.select("symbol", "features", "open_time", "label"), FEATURE_COLUMNS


def train_level_0_batches(df, output_path, feature_cols):
    """Train Level 0 RandomForest models in batches."""
    print("\n" + "="*50)
    print(f"LEVEL 0: BATCH TRAINING (Split: {SPLIT_RATIO})")
    print("="*50)
    
    if os.path.exists(output_path):
        print(f"  Removing existing output: {output_path}")
        try:
            shutil.rmtree(output_path) if os.path.isdir(output_path) else os.remove(output_path)
        except Exception as e:
            print(f"  Error deleting {output_path}: {e}")
            return None
    
    # Checkpoint input DataFrame before processing
    print("  Checkpointing input DataFrame before Level 0 training...")
    df = df.checkpoint()
    _ = df.count()  # Force checkpoint execution
    check_memory("After Checkpoint (Before Level 0 Training)")
    
    split_time = get_split_threshold(df, "open_time", SPLIT_RATIO)
    if split_time is None:
        raise ValueError("Could not calculate split threshold.")
    print(f"  Split Time Threshold: {split_time}")
    
    symbols = [row.symbol for row in df.select("symbol").distinct().collect()]
    num_batches = math.ceil(len(symbols) / LEVEL_0_BATCH_SIZE)
    print(f"  Total Symbols: {len(symbols)}, Batches: {num_batches}")
    
    for i in range(num_batches):
        batch_symbols = symbols[i*LEVEL_0_BATCH_SIZE : (i+1)*LEVEL_0_BATCH_SIZE]
        print(f"\n  Processing Batch {i+1}/{num_batches}: {batch_symbols}")
        
        batch_df = df.filter(col("symbol").isin(batch_symbols))
        
        # Checkpoint batch DataFrame
        batch_df = batch_df.checkpoint()
        _ = batch_df.count()  # Force checkpoint execution
        
        train = batch_df.filter(col("open_time") < split_time)
        test = batch_df.filter(col("open_time") >= split_time)
        
        # Checkpoint train/test splits
        train = train.checkpoint()
        test = test.checkpoint()
        _ = train.count()  # Force checkpoint execution
        _ = test.count()  # Force checkpoint execution
        
        # --- FIX 1: Volatility Filter (Remove Noise) ---
        # We calculate the average volatility for this specific batch.
        # Any candle with volatility < 50% of the average is treated as "noise" and removed.
        try:
            # We use 'features' vector or if you have a raw 'volatility' column from generation
            # Assuming 'volatility' column still exists or was preserved. 
            # If strictly using 'features' vector, this needs the raw column. 
            # ensuring safety:
            if "volatility" in train.columns:
                avg_vol = train.select(functions.avg("volatility")).collect()[0][0]
                if avg_vol and avg_vol > 0:
                    print(f"  [Filter] Removing low volatility noise (Threshold: {avg_vol * 0.5:.5f})")
                    train = train.filter(col("volatility") > avg_vol * 0.5)
        except Exception as e:
            print(f"  [Warning] Volatility filter skipped: {e}")

        if train.count() == 0:
            print("  Skipping batch (empty train data)")
            continue
            
        # --- FIX 2: Class Weighting (Fix Imbalance) ---
        # We calculate weights dynamically so the model cares about "UP" moves.
        train_count = train.count()
        up_count = train.filter(col("label") == 1).count()
        down_count = train_count - up_count
        
        if up_count > 0 and down_count > 0:
            balancing_ratio = down_count / up_count
            print(f"  [Class Balance] UP: {up_count}, DOWN: {down_count}, Ratio: 1:{balancing_ratio:.2f}")
            
            # Create a weight column: UP gets higher weight, DOWN gets 1.0
            train = train.withColumn("classWeight", 
                when(col("label") == 1, lit(balancing_ratio))
                .otherwise(lit(1.0))
            )
            weight_col = "classWeight"
        else:
            print("  [Warning] Only one class present. Skipping weights.")
            weight_col = None

        # --- Train Model ---
        rf = RandomForestClassifier(
            labelCol="label",
            featuresCol="features",
            weightCol=weight_col,       # Apply the class weights
            numTrees=NUM_TREES,
            maxDepth=MAX_DEPTH,
            seed=SEED
        )
        model = rf.fit(train)

        # === ВСТАВИТИ ЦЕЙ БЛОК ===
        print(f"\n  [Batch {i+1}] Feature Importance:")
        # Отримуємо вектор важливості
        importances = model.featureImportances
        
        # Створюємо список (Назва, Важливість)
        feature_list = []
        for idx, imp in enumerate(importances):
            # Перевірка на всяк випадок, щоб індекс не вийшов за межі
            if idx < len(feature_cols):
                feature_list.append((feature_cols[idx], imp))
        
        # Сортуємо від найважливіших до найменш важливих
        feature_list.sort(key=lambda x: x[1], reverse=True)
        
        # Виводимо ТОП-10 фіч для цього батчу
        for feat_name, feat_imp in feature_list[:10]:
            print(f"    {feat_name:<30}: {feat_imp:.4f}")
        # ==========================

        model.write().overwrite().save(f"model/level0_batch_{i+1}.parquet")
        
        predictions = model.transform(test)
        batch_oof = predictions.select("symbol", "open_time", "label", "probability")
        batch_oof.write.mode("append").parquet(output_path)
        
        # Unpersist batch DataFrames after writing
        try:
            batch_df.unpersist()
            train.unpersist()
            test.unpersist()
            predictions.unpersist()
        except:
            pass
    
    # Unpersist main df at end of function
    try:
        df.unpersist()
    except:
        pass
    
    return output_path


def main():
    """Main execution pipeline."""
    # Data loading
    check_memory("After Spark Initialization")
    
    # Load all Binance data from Kaggle dataset
    print("\n" + "="*60)
    print("LOADING BINANCE DATA")
    print("="*60)
    df = load_binance_data(spark, DATA_DIR, sample_fraction=DATA_SAMPLE_FRACTION)
    check_memory("After Loading All Parquet Files")
    
    # Checkpoint immediately after loading to free memory
    print("Checkpointing after data loading...")
    df = df.checkpoint()
    _ = df.count()  # Force checkpoint execution
    check_memory("After Checkpoint (Data Loading)")
    
    print(f"Original data count: {df.count()}")
    
    # Check if symbol column exists (should be added by load_binance_data if missing)
    if "symbol" not in df.columns:
        print("Warning: No symbol column found. Adding default symbol.")
        df = df.withColumn("symbol", lit("UNKNOWN"))
    
    check_memory("After Adding Symbol Column")
    
    # Checkpoint after symbol column
    print("Checkpointing after adding symbol column...")
    df = df.checkpoint()
    _ = df.count()  # Force checkpoint execution
    check_memory("After Checkpoint (Symbol Column)")
    
    print(f"Count before resampling: {df.count()}")
    df = aggregate_candles(df, interval_minutes=30)
    
    # Checkpoint after resampling
    print("Checkpointing after resampling...")
    df = df.checkpoint()
    _ = df.count()  # Force checkpoint execution
    check_memory("After Checkpoint (Resampling)")
    
    print(f"Count after resampling: {df.count()}")
    
    # Use sample for show to avoid memory issues
    df.sample(fraction=0.001, seed=42).show(5)
    
    check_memory("After Resampling to 30m")
    
    # Cleanup before feature generation
    cleanup_memory()
    
    # Feature generation (works on all symbols)
    num_symbols = df.select("symbol").distinct().count()
    print(f"\nGenerating features for {num_symbols} symbols...")
    df_train_features, FEATURE_COLUMNS = generate_features(df, f"All Symbols ({num_symbols})")
    
    # Aggressively unpersist and cleanup
    try:
        df.unpersist()
    except:
        pass
    del df  # Explicitly delete reference
    cleanup_memory()
    check_memory("After Feature Generation (Unpersisted Original DF)")
    
    # Write features to Parquet to break lineage and free memory
    FEATURES_PARQUET_PATH = "features_cache.parquet"
    print(f"Writing features to Parquet: {FEATURES_PARQUET_PATH}")
    if os.path.exists(FEATURES_PARQUET_PATH):
        shutil.rmtree(FEATURES_PARQUET_PATH) if os.path.isdir(FEATURES_PARQUET_PATH) else os.remove(FEATURES_PARQUET_PATH)
    df_train_features.write.mode("overwrite").parquet(FEATURES_PARQUET_PATH)
    check_memory("After Writing Features to Parquet")
    
    # Reload from disk to break lineage completely
    print("Reloading features from Parquet...")
    # Aggressively unpersist old DataFrame
    try:
        df_train_features.unpersist()
    except:
        pass
    del df_train_features  # Delete reference
    cleanup_memory()
    
    df_train_features = spark.read.parquet(FEATURES_PARQUET_PATH)
    check_memory("After Reloading Features from Parquet")
    
    # Data scaling
    print("Scaling features...")
    
    # Checkpoint before scaling
    print("Checkpointing before scaling...")
    df_train_features = df_train_features.checkpoint()
    _ = df_train_features.count()  # Force checkpoint execution
    check_memory("After Checkpoint (Before Scaling)")
    
    # Store path for later use in Level 1
    FEATURES_PARQUET_PATH = "features_cache.parquet"
    
    scaler = StandardScaler(inputCol="features", outputCol="features_scaled", withStd=True, withMean=True)
    scaler_model = scaler.fit(df_train_features)
    
    # Checkpoint after fit
    print("Checkpointing after scaler fit...")
    df_train_features = df_train_features.checkpoint()
    _ = df_train_features.count()  # Force checkpoint execution
    
    df_train_features = scaler_model.transform(df_train_features)
    
    # Checkpoint after transform
    print("Checkpointing after scaler transform...")
    df_train_features = df_train_features.checkpoint()
    _ = df_train_features.count()  # Force checkpoint execution
    
    df_train_features = df_train_features.drop("features").withColumnRenamed("features_scaled", "features")
    
    # Final checkpoint after scaling complete
    print("Checkpointing scaled features to disk...")
    df_train_features = df_train_features.checkpoint()
    _ = df_train_features.count()  # Force checkpoint execution
    check_memory("After Scaling and Checkpoint")
    
    df_train_features.show(5)
    
    # Level 0 training
    oof_path = train_level_0_batches(df_train_features, OOF_OUTPUT_PATH, FEATURE_COLUMNS)
    
    # Aggressively unpersist features DataFrame after Level 0 training
    try:
        df_train_features.unpersist()
    except:
        pass
    del df_train_features  # Delete reference
    cleanup_memory()
    check_memory("After Level 0 Training (Unpersisted Features)")
    
    # Level 0 evaluation
    print("\n" + "="*50)
    print("LEVEL 0 EVALUATION")
    print("="*50)
    
    oof_df = spark.read.parquet(OOF_OUTPUT_PATH)
    
    # Checkpoint after loading OOF predictions
    print("Checkpointing OOF predictions...")
    oof_df = oof_df.checkpoint()
    _ = oof_df.count()  # Force checkpoint execution
    check_memory("After Checkpoint (OOF Predictions)")
    
    oof_df.show(5)
    oof_df = oof_df.withColumn("prob_up", vector_to_array("probability")[1])
    
    # Checkpoint after prob_up
    oof_df = oof_df.checkpoint()
    _ = oof_df.count()  # Force checkpoint execution
    
    oof_df.show(5)
    oof_df = oof_df.withColumn("prediction", when(col("prob_up") > 0.5, 1.0).otherwise(0.0))
    
    # Checkpoint after prediction
    oof_df = oof_df.checkpoint()
    _ = oof_df.count()  # Force checkpoint execution
    
    oof_df.show(5)
    
    evaluator_acc = MulticlassClassificationEvaluator(metricName="accuracy")
    evaluator_f1 = MulticlassClassificationEvaluator(metricName="weightedFMeasure")
    evaluator_auc = BinaryClassificationEvaluator(labelCol="label", rawPredictionCol="probability", metricName="areaUnderROC")
    
    l0_accuracy = evaluator_acc.evaluate(oof_df)
    l0_f1 = evaluator_f1.evaluate(oof_df)
    l0_auc = evaluator_auc.evaluate(oof_df)
    
    print(f"  Level 0 Accuracy: {l0_accuracy:.2%}")
    print(f"  Level 0 F1 Score: {l0_f1:.2%}")
    print(f"  Level 0 AUC: {l0_auc:.2%}")
    
    check_memory("After Level 0 Evaluation")
    



    # Level 1 training
    print("\n" + "="*50)
    print("LEVEL 1 TRAINING (With Context)")
    print("="*50)

    # 1. Fetch Context (Original Market Features)
    # We retrieve the original technical indicators (RSI, Volatility, etc.) to give Level 1 context.
    # Reload features (they were unpersisted after Level 0 training)
    print("  Reloading features for Level 1 context...")
    features_parquet_path = "features_cache.parquet"  # Same path used earlier
    context_df = spark.read.parquet(features_parquet_path).select("symbol", "open_time", "features")
    context_df = context_df.checkpoint()
    _ = context_df.count()  # Force checkpoint execution
    check_memory("After Loading Context Features")

    # 2. Join Context with Level 0 Predictions
    # oof_df contains the probability from Level 0. We join it with the market features.
    print("  Joining Level 0 predictions with context...")
    l1_data = oof_df.join(context_df, on=["symbol", "open_time"], how="inner")
    
    # Checkpoint after join
    l1_data = l1_data.checkpoint()
    _ = l1_data.count()  # Force checkpoint execution
    check_memory("After Join (Level 1 Data)")

    # 3. Create Meta-Features (Market State + Level 0 Prediction)
    # VectorAssembler in Spark can merge an existing Vector column ("features") 
    # with a scalar column ("prob_up") into a new, longer vector.
    l1_assembler = VectorAssembler(
        inputCols=["features", "prob_up"], 
        outputCol="meta_features"
    )
    l1_data = l1_assembler.transform(l1_data)
    
    # Checkpoint after vector assembly
    l1_data = l1_data.checkpoint()
    _ = l1_data.count()  # Force checkpoint execution
    check_memory("After Vector Assembly (Level 1)")
    
    # 4. Split Data (Time-based)
    l1_split_time = get_split_threshold(l1_data, "open_time", 0.5)
    
    # 5. Prepare Train/Test sets
    # CRITICAL: We must drop 'prediction', 'probability', and 'rawPrediction' because 
    # they currently contain Level 0 results. If we don't drop them, the Level 1 model 
    # will crash when trying to create its own columns with the same names.
    cols_to_drop = ["prediction", "probability", "rawPrediction", "features"]
    
    l1_train = l1_data.filter(col("open_time") < l1_split_time).drop(*cols_to_drop)
    l1_test = l1_data.filter(col("open_time") >= l1_split_time).drop(*cols_to_drop)
    
    # Checkpoint train/test splits
    l1_train = l1_train.checkpoint()
    l1_test = l1_test.checkpoint()
    _ = l1_train.count()  # Force checkpoint execution
    _ = l1_test.count()  # Force checkpoint execution
    check_memory("After Level 1 Train/Test Split")
    
    print(f"  Level 1 Train Size: {l1_train.count()}")
    print(f"  Level 1 Test Size: {l1_test.count()}")
    
    # 6. Train Level 1 Model
    rf_meta = RandomForestClassifier(
        labelCol="label",
        featuresCol="meta_features", # Now training on Context + Prob
        numTrees=100,
        maxDepth=8,
        seed=SEED
    )
    l1_model = rf_meta.fit(l1_train)
    l1_model.write().overwrite().save("model/level1_meta_rf.parquet")
    print("  Level 1 Model Saved.")
    
    # Aggressively unpersist Level 1 training DataFrames
    try:
        l1_train.unpersist()
        l1_test.unpersist()
    except:
        pass
    del l1_train, l1_test  # Delete references
    cleanup_memory()
    
    l1_predictions = l1_model.transform(l1_test)
    
    # Checkpoint Level 1 predictions
    l1_predictions = l1_predictions.checkpoint()
    _ = l1_predictions.count()  # Force checkpoint execution
    check_memory("After Level 1 Training")
    

    # Evaluate Level 1 model performance (Accuracy, F1, AUC)
    l1_acc = evaluator_acc.evaluate(l1_predictions)
    l1_f1 = evaluator_f1.evaluate(l1_predictions)
    l1_auc = evaluator_auc.evaluate(l1_predictions)
    
    print(f"\n>>> LEVEL 1 ACCURACY: {l1_acc:.2%} <<<")
    print(f"  Level 1 F1 Score: {l1_f1:.2%}")
    print(f"  Level 1 AUC: {l1_auc:.2%}")






    # Level 2 training
    print("\n" + "="*50)
    print("LEVEL 2 TRAINING (Logistic Regression)")
    print("="*50)
    
    l1_predictions = l1_predictions.withColumn("l1_prob_up", vector_to_array("probability")[1])
    
    # Checkpoint after l1_prob_up
    l1_predictions = l1_predictions.checkpoint()
    _ = l1_predictions.count()  # Force checkpoint execution
    
    l2_assembler = VectorAssembler(inputCols=["l1_prob_up"], outputCol="final_features")
    l2_data = l2_assembler.transform(l1_predictions).drop("prediction", "probability", "rawPrediction")
    
    # Checkpoint Level 2 data before training
    l2_data = l2_data.checkpoint()
    _ = l2_data.count()  # Force checkpoint execution
    check_memory("After Level 2 Data Preparation")
    
    lr = LogisticRegression(labelCol="label", featuresCol="final_features", regParam=0.01)
    l2_model = lr.fit(l2_data)
    l2_model.write().overwrite().save("model/level2_logistic.parquet")
    print("  Level 2 Model Saved.")
    
    # Final evaluation (before unpersisting l2_data)
    final_predictions = l2_model.transform(l2_data)
    
    # Checkpoint final predictions
    final_predictions = final_predictions.checkpoint()
    _ = final_predictions.count()  # Force checkpoint execution
    check_memory("After Final Predictions")
    
    final_acc = evaluator_acc.evaluate(final_predictions)
    final_f1 = evaluator_f1.evaluate(final_predictions)
    final_auc = evaluator_auc.evaluate(final_predictions)
    
    print(f"\n>>> FINAL SYSTEM ACCURACY: {final_acc:.2%} <<<")
    print(f"  Final F1 Score: {final_f1:.2%}")
    print(f"  Final AUC: {final_auc:.2%}")
    
    # Unpersist all DataFrames to free memory
    # Unpersist Level 1 and Level 2 intermediate DataFrames
    try:
        l1_predictions.unpersist()
        l2_data.unpersist()
    except:
        pass
    print("\nUnpersisting all DataFrames...")
    try:
        df.unpersist()
    except:
        pass
    try:
        df_train_features.unpersist()
    except:
        pass
    try:
        oof_df.unpersist()
    except:
        pass
    try:
        l1_data.unpersist()
    except:
        pass
    try:
        l1_train.unpersist()
    except:
        pass
    try:
        l1_test.unpersist()
    except:
        pass
    try:
        l1_predictions.unpersist()
    except:
        pass
    try:
        l2_data.unpersist()
    except:
        pass
    try:
        final_predictions.unpersist()
    except:
        pass
    
    check_memory("After Unpersisting All DataFrames")
    
    spark.stop()


if __name__ == "__main__":
    main()
