# Scalable Pattern Recognition System - Architecture Explanation

## Project Overview

This is a **PySpark-based machine learning system** for predicting short-term cryptocurrency price movements using **3-level Stacked Generalization (Stacking)**. The system processes cryptocurrency market data stored in Parquet format and trains an ensemble of models to predict volatility-based price movements.

## Project Structure

```
Binance Pattern Recognition/
├── src/
│   ├── data_ingestion/
│   │   ├── __init__.py
│   │   └── loader.py              # Parquet file loading, batching, time-based splitting
│   ├── features/
│   │   ├── __init__.py
│   │   └── pipeline.py            # Feature engineering with Window functions
│   └── models/
│       ├── __init__.py
│       └── stacking_manager.py    # 3-level stacking ensemble logic
├── main_train.py                   # Main training pipeline entry point
├── requirements.txt                # Dependencies (pyspark, findspark, numpy, pandas)
└── README.md                       # Documentation
```

## Architecture Components

### 1. Data Ingestion Module (`src/data_ingestion/loader.py`)

**Purpose**: Load and organize Parquet files for batch processing.

**Key Functions**:
- `list_parquet_files(data_dir)`: Lists all Parquet files in directory, sorted by symbol
- `load_parquet_batch(spark, file_paths)`: Loads multiple Parquet files and unions them into single DataFrame
- `get_symbol_batches(spark, data_dir, batch_size=10)`: Groups files by symbol and creates batches (default: 10 symbols per batch)
- `split_train_holdout(df, time_column, train_ratio=0.9)`: **Time-based split** (not random) - first 90% of time for training, last 10% for holdout

**Critical Design Decision**: Uses **time-based splitting** instead of random split to prevent data leakage. The split is based on `open_time` column, ensuring no future data is used for training.

### 2. Feature Engineering Module (`src/features/pipeline.py`)

**Purpose**: Create technical indicators and features using PySpark Window functions.

**Key Function**: `create_feature_pipeline(df)`

**Features Created**:
1. **Lag Features**: `lag1_close`, `lag2_close`, `lag3_close` (previous period prices)
2. **Return Features**: `return_1`, `return_2` (price changes/returns)
3. **Volatility Features**: 
   - `hl_spread`: (high - low) / close
   - `std_5`: Rolling standard deviation over 5 periods
   - `std_10`: Rolling standard deviation over 10 periods
4. **Volume Features**: `lag1_volume`, `volume_change`
5. **Technical Indicators**: `mean_5`, `price_ma_ratio` (price relative to moving average)

**Critical Implementation**:
```python
window_spec = Window.partitionBy("symbol").orderBy("open_time")
```

**Why `partitionBy("symbol")` is Essential**:
- Prevents **cross-symbol data leakage**
- Each symbol's features are computed independently within its own time series
- Without partitioning, lag features from one symbol could influence another symbol's features
- Ensures temporal ordering is preserved per symbol

**Final Step**: Uses `VectorAssembler` to combine all features into a single `features` vector column (required for PySpark ML algorithms).

### 3. Stacking Manager Module (`src/models/stacking_manager.py`)

**Purpose**: Implements 3-level stacked generalization ensemble.

**Class**: `StackingManager`

#### Level 0: Base Models
- **Algorithm**: `RandomForestClassifier` (100 trees, max_depth=10)
- **Training**: One model per batch of symbols
- **Input**: Engineered features from `create_feature_pipeline()`
- **Output**: Probability of high volatility (class 1)
- **Persistence**: Models saved to `models/level0_batch_{batch_id}/`
- **Method**: `train_level0()` trains and saves model, `predict_level0()` generates predictions

#### Level 1: First Meta-Learner
- **Algorithm**: `RandomForestClassifier` (50 trees, max_depth=8)
- **Input**: Level 0 predictions from ALL batches (combined as features)
- **Output**: Probability of high volatility
- **Purpose**: Learns how to optimally combine Level 0 predictions
- **Persistence**: Model saved to `models/level1_model/`
- **Method**: `train_level1()` combines Level 0 predictions, trains meta-learner

#### Level 2: Final Meta-Model
- **Algorithm**: `LogisticRegression` (maxIter=100, regParam=0.01, elasticNetParam=0.5)
- **Input**: Level 1 predictions
- **Output**: Final probability of high volatility
- **Purpose**: Final decision-making layer
- **Persistence**: Model saved to `models/level2_model/`
- **Method**: `train_level2()` trains final meta-model

**Additional Method**: `create_volatility_label()` - Creates binary labels based on future volatility (high volatility = 1, low = 0) using forward-looking returns.

### 4. Main Training Script (`main_train.py`)

**Purpose**: Orchestrates the entire training pipeline.

**Execution Flow**:

1. **Initialization**:
   - Uses `findspark.init()` to locate Spark installation
   - Creates SparkSession with adaptive query execution enabled
   - Initializes `StackingManager`

2. **Data Loading**:
   - Gets symbol batches from Parquet directory
   - Processes in batches of 10 symbols (configurable)

3. **For Each Batch**:
   - Loads Parquet files for the batch
   - Applies feature engineering pipeline
   - Creates volatility-based labels
   - **Time-based split**: 90% train, 10% holdout
   - Trains Level 0 RandomForest model
   - Generates Level 0 predictions on holdout set
   - Caches predictions for later use

4. **Level 1 Training**:
   - Combines all Level 0 predictions from all batches
   - Trains RandomForest meta-learner
   - Generates Level 1 predictions

5. **Level 2 Training**:
   - Trains LogisticRegression final meta-model on Level 1 predictions
   - Generates final predictions

6. **Model Persistence**:
   - All models saved to `models/` directory
   - Models can be loaded later for streaming inference

## Data Flow

```
Parquet Files
    ↓
[Data Ingestion] → Load & Batch by Symbol
    ↓
[Feature Engineering] → Window Functions (partitioned by symbol)
    ↓
[Label Creation] → Volatility-based binary labels
    ↓
[Time Split] → Train (90%) / Holdout (10%)
    ↓
[Level 0 Training] → RandomForest per batch → Predictions
    ↓
[Level 1 Training] → Combine L0 predictions → RandomForest → Predictions
    ↓
[Level 2 Training] → LogisticRegression → Final Predictions
    ↓
[Model Persistence] → Save all models
```

## Key Design Principles

### 1. Data Leakage Prevention

**Symbol Partitioning**:
- All Window functions use `Window.partitionBy("symbol").orderBy("open_time")`
- Ensures features are computed within each symbol's time series only
- Prevents cross-symbol contamination

**Time-Based Splitting**:
- Train/holdout split based on time, not random
- First 90% of chronological data → training
- Last 10% of chronological data → holdout
- Prevents future data from leaking into training

### 2. Scalability

**Batch Processing**:
- Processes symbols in batches (default: 10 per batch)
- Allows handling of large datasets with many cryptocurrency pairs
- Each batch can be processed independently

**PySpark Distributed Computing**:
- Leverages Spark's distributed processing capabilities
- Handles large-scale data efficiently
- Models can be trained on clusters

### 3. Model Persistence

**PySpark ML Format**:
- All models saved using PySpark's native persistence
- Models can be loaded later for streaming inference
- Compatible with Spark Streaming pipelines

## Expected Data Format

Parquet files must contain:
- `symbol`: Cryptocurrency symbol (e.g., "BTCUSDT")
- `open_time`: Timestamp (numeric or datetime) - used for ordering and splitting
- `open`, `high`, `low`, `close`: OHLC price data
- `volume`: Trading volume

## Configuration

Modify in `main_train.py`:
- `DATA_DIR`: Path to Parquet files (default: "data/parquet")
- `MODEL_DIR`: Path to save models (default: "models")
- `BATCH_SIZE`: Symbols per batch (default: 10)

## Technical Stack

- **PySpark 3.5+**: Distributed computing and ML
- **findspark**: Automatic Spark initialization
- **Python 3.8+**: Runtime environment
- **Java 8/11**: Required for Spark

## Usage

```bash
# Install dependencies
pip install -r requirements.txt

# Run training
python main_train.py
```

## Model Loading for Inference

```python
from pyspark.ml.classification import (
    RandomForestClassificationModel,
    LogisticRegressionModel
)

# Load Level 0 model
level0_model = RandomForestClassificationModel.load("models/level0_batch_0")

# Load Level 1 model
level1_model = RandomForestClassificationModel.load("models/level1_model")

# Load Level 2 model
level2_model = LogisticRegressionModel.load("models/level2_model")
```

## Important Notes

1. **Window Functions**: Always partitioned by symbol to prevent leakage
2. **Time Ordering**: All operations respect temporal ordering within each symbol
3. **Null Handling**: Feature engineering handles nulls at beginning of time series (from lag/window functions)
4. **Reproducibility**: All models use `seed=42` for consistent results
5. **Vector Format**: All features must be assembled into vector column for PySpark ML

## Extension Points

- **Streaming Inference**: Models can be loaded for real-time predictions
- **Hyperparameter Tuning**: Add grid search or cross-validation
- **Additional Features**: Extend `create_feature_pipeline()` with more indicators
- **Evaluation Metrics**: Add ROC-AUC, precision-recall, confusion matrix
- **Model Versioning**: Implement model registry for production deployments
