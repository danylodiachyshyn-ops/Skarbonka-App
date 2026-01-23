"""Feature engineering pipeline using PySpark Window functions."""

from pyspark.sql import DataFrame
from pyspark.sql.functions import (
    col, lag, stddev, mean, 
    Window, when, isnan, isnull
)
from pyspark.ml.feature import VectorAssembler
from pyspark.ml import Pipeline


def create_feature_pipeline(df: DataFrame) -> DataFrame:
    """
    Create feature engineering pipeline with lag features and rolling statistics.
    
    This function uses Window.partitionBy("symbol").orderBy("open_time") to ensure
    that lag features and rolling statistics are computed within each symbol only,
    preventing cross-symbol data leakage. This is critical because:
    1. Different symbols have different price scales and volatility patterns
    2. Using data from one symbol to predict another would be data leakage
    3. Time-based ordering ensures temporal consistency within each symbol
    
    Args:
        df: Input DataFrame with columns: symbol, open_time, open, high, low, close, volume
        
    Returns:
        DataFrame with additional feature columns and a 'features' vector column
    """
    # Define window specification partitioned by symbol and ordered by time
    # This ensures features are computed within each symbol's time series only
    window_spec = Window.partitionBy("symbol").orderBy("open_time")
    
    # Create lag features (previous values)
    # Lag 1: previous period's close price
    df = df.withColumn("lag1_close", lag("close", 1).over(window_spec))
    
    # Lag 2: two periods ago
    df = df.withColumn("lag2_close", lag("close", 2).over(window_spec))
    
    # Lag 3: three periods ago
    df = df.withColumn("lag3_close", lag("close", 3).over(window_spec))
    
    # Price changes (returns)
    df = df.withColumn("return_1", (col("close") - col("lag1_close")) / col("lag1_close"))
    df = df.withColumn("return_2", (col("lag1_close") - col("lag2_close")) / col("lag2_close"))
    
    # High-Low spread (volatility proxy)
    df = df.withColumn("hl_spread", (col("high") - col("low")) / col("close"))
    
    # Volume features
    df = df.withColumn("lag1_volume", lag("volume", 1).over(window_spec))
    df = df.withColumn("volume_change", (col("volume") - col("lag1_volume")) / col("lag1_volume"))
    
    # Rolling statistics using window functions
    # Standard deviation over last 5 periods (volatility measure)
    window_5 = Window.partitionBy("symbol").orderBy("open_time").rowsBetween(-4, 0)
    df = df.withColumn("std_5", stddev("close").over(window_5))
    
    # Standard deviation over last 10 periods
    window_10 = Window.partitionBy("symbol").orderBy("open_time").rowsBetween(-9, 0)
    df = df.withColumn("std_10", stddev("close").over(window_10))
    
    # Mean over last 5 periods
    df = df.withColumn("mean_5", mean("close").over(window_5))
    
    # Price relative to moving average
    df = df.withColumn("price_ma_ratio", col("close") / col("mean_5"))
    
    # Fill null values that occur at the beginning of each symbol's time series
    # (due to lag and window functions)
    feature_columns = [
        "lag1_close", "lag2_close", "lag3_close",
        "return_1", "return_2",
        "hl_spread",
        "lag1_volume", "volume_change",
        "std_5", "std_10", "mean_5", "price_ma_ratio"
    ]
    
    for col_name in feature_columns:
        df = df.withColumn(
            col_name,
            when(isnan(col(col_name)) | isnull(col(col_name)), 0.0)
            .otherwise(col(col_name))
        )
    
    # Select base features for vectorization
    # Include original price/volume features and engineered features
    base_features = [
        "open", "high", "low", "close", "volume",
        "lag1_close", "lag2_close", "lag3_close",
        "return_1", "return_2",
        "hl_spread",
        "lag1_volume", "volume_change",
        "std_5", "std_10", "mean_5", "price_ma_ratio"
    ]
    
    # Use VectorAssembler to create a features vector column
    # This is required for PySpark ML algorithms
    assembler = VectorAssembler(
        inputCols=base_features,
        outputCol="features",
        handleInvalid="skip"  # Skip rows with invalid values
    )
    
    # Transform the DataFrame
    df = assembler.transform(df)
    
    # Drop rows where features couldn't be assembled (shouldn't happen with handleInvalid="skip")
    df = df.filter(col("features").isNotNull())
    
    return df
