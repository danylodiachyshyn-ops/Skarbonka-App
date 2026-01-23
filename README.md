# Scalable Pattern Recognition System in Cryptocurrency Markets

A PySpark-based machine learning system for predicting short-term cryptocurrency price movements using stacked generalization (stacking) ensemble methods.

## Overview

This project implements a 3-level stacked generalization architecture:

- **Level 0**: Base RandomForest classifiers trained on batches of cryptocurrency symbols
- **Level 1**: Meta-learner RandomForest trained on Level 0 predictions
- **Level 2**: Final LogisticRegression meta-model trained on Level 1 predictions

The system uses volatility-based labeling to predict short-term price movements, with careful attention to preventing data leakage through time-based splitting and symbol-partitioned feature engineering.

## Project Structure

```
.
├── src/
│   ├── data_ingestion/
│   │   ├── __init__.py
│   │   └── loader.py          # Parquet file loading and batch processing
│   ├── features/
│   │   ├── __init__.py
│   │   └── pipeline.py        # Feature engineering with Window functions
│   └── models/
│       ├── __init__.py
│       └── stacking_manager.py  # 3-level stacking implementation
├── main_train.py              # Main training entry point
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## Features

### Data Leakage Prevention

- **Symbol Partitioning**: All Window functions use `partitionBy("symbol")` to ensure features are computed within each symbol's time series only, preventing cross-symbol leakage.
- **Time-Based Splitting**: Train/holdout split is strictly time-based (90/10), not random, ensuring no future data is used for training.

### Feature Engineering

The `create_feature_pipeline()` function creates:
- **Lag Features**: Previous period prices (lag1, lag2, lag3)
- **Return Features**: Price changes and returns
- **Volatility Features**: High-low spread, rolling standard deviations
- **Volume Features**: Volume changes and lagged volume
- **Technical Indicators**: Price-to-moving-average ratios

All features are assembled into a vector column using `VectorAssembler` for PySpark ML compatibility.

### Batch Processing

The system processes data in batches of 10 symbols at a time, making it scalable for large datasets with many cryptocurrency pairs.

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure you have Java 8 or 11 installed (required for PySpark):
```bash
java -version
```

3. Set up your data directory structure:
```
data/
  parquet/
    symbol1_timestamp.parquet
    symbol2_timestamp.parquet
    ...
```

## Usage

### Training

Run the main training script:

```bash
python main_train.py
```

The script will:
1. Load Parquet files from `data/parquet/`
2. Process symbols in batches of 10
3. Create features using Window functions
4. Train Level 0 models on each batch
5. Generate Level 0 predictions on holdout sets
6. Train Level 1 meta-learner
7. Train Level 2 final meta-model
8. Save all models to `models/` directory

### Expected Data Format

Parquet files should contain the following columns:
- `symbol`: Cryptocurrency symbol (e.g., "BTCUSDT")
- `open_time`: Timestamp (numeric or datetime)
- `open`, `high`, `low`, `close`: OHLC price data
- `volume`: Trading volume

## Model Architecture

### Level 0: Base Models
- **Algorithm**: RandomForestClassifier
- **Input**: Engineered features (lag, returns, volatility, volume)
- **Output**: Probability of high volatility (class 1)
- **Training**: One model per batch of symbols

### Level 1: First Meta-Learner
- **Algorithm**: RandomForestClassifier
- **Input**: Level 0 predictions from all batches
- **Output**: Probability of high volatility
- **Purpose**: Learn to combine Level 0 predictions

### Level 2: Final Meta-Model
- **Algorithm**: LogisticRegression
- **Input**: Level 1 predictions
- **Output**: Final probability of high volatility
- **Purpose**: Final decision-making layer

## Key Implementation Details

### Window Functions for Feature Engineering

```python
window_spec = Window.partitionBy("symbol").orderBy("open_time")
```

This ensures:
- Features are computed within each symbol only
- Temporal ordering is preserved
- No cross-symbol data leakage

### Time-Based Splitting

```python
train_df, holdout_df = split_train_holdout(
    df,
    time_column="open_time",
    train_ratio=0.9
)
```

This ensures:
- First 90% of time → training set
- Last 10% of time → holdout set
- No future data leakage

## Model Persistence

All models are saved using PySpark's ML persistence:
- Level 0 models: `models/level0_batch_{batch_id}/`
- Level 1 model: `models/level1_model/`
- Level 2 model: `models/level2_model/`

Models can be loaded later for streaming inference:

```python
from pyspark.ml.classification import RandomForestClassificationModel

model = RandomForestClassificationModel.load("models/level0_batch_0")
```

## Configuration

Modify these variables in `main_train.py`:
- `DATA_DIR`: Path to Parquet files directory
- `MODEL_DIR`: Path to save models
- `BATCH_SIZE`: Number of symbols per batch (default: 10)

## Notes

- The system uses `findspark.init()` to automatically locate Spark installation
- All models use seed=42 for reproducibility
- Feature engineering handles null values that occur at the beginning of time series
- The system is designed for batch training; streaming inference can be added separately

## Future Enhancements

- Add streaming inference pipeline
- Implement model evaluation metrics
- Add hyperparameter tuning
- Support for additional feature engineering techniques
- Real-time prediction API
