"""Parquet file loader for batch processing cryptocurrency data."""

from pathlib import Path
from typing import List, Tuple
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import col


def list_parquet_files(data_dir: str) -> List[str]:
    """
    List all Parquet files in the specified directory.
    
    Args:
        data_dir: Path to directory containing Parquet files
        
    Returns:
        List of file paths sorted by symbol (extracted from filename)
    """
    data_path = Path(data_dir)
    parquet_files = sorted([str(f) for f in data_path.glob("*.parquet")])
    return parquet_files


def load_parquet_batch(
    spark: SparkSession,
    file_paths: List[str],
    symbol_column: str = "symbol"
) -> DataFrame:
    """
    Load a batch of Parquet files and combine them into a single DataFrame.
    
    Args:
        spark: SparkSession instance
        file_paths: List of Parquet file paths to load
        symbol_column: Name of the symbol column (default: "symbol")
        
    Returns:
        Combined DataFrame with all parquet data
    """
    if not file_paths:
        raise ValueError("No file paths provided")
    
    dfs = []
    for file_path in file_paths:
        df = spark.read.parquet(file_path)
        dfs.append(df)
    
    # Union all DataFrames
    combined_df = dfs[0]
    for df in dfs[1:]:
        combined_df = combined_df.union(df)
    
    return combined_df


def get_symbol_batches(
    spark: SparkSession,
    data_dir: str,
    batch_size: int = 10
) -> List[List[str]]:
    """
    Group Parquet files by symbol and create batches for processing.
    
    Args:
        spark: SparkSession instance
        data_dir: Path to directory containing Parquet files
        batch_size: Number of symbols to process per batch (default: 10)
        
    Returns:
        List of batches, where each batch is a list of file paths
    """
    parquet_files = list_parquet_files(data_dir)
    
    # Extract symbols from filenames (assuming format: symbol_timestamp.parquet)
    # If files are already organized by symbol, group them
    symbol_to_files = {}
    
    for file_path in parquet_files:
        # Try to extract symbol from filename
        filename = Path(file_path).stem
        # Assuming format: symbol_timestamp or just symbol
        parts = filename.split('_')
        symbol = parts[0] if parts else filename
        
        if symbol not in symbol_to_files:
            symbol_to_files[symbol] = []
        symbol_to_files[symbol].append(file_path)
    
    # Sort symbols for consistent batching
    sorted_symbols = sorted(symbol_to_files.keys())
    
    # Create batches
    batches = []
    for i in range(0, len(sorted_symbols), batch_size):
        batch_symbols = sorted_symbols[i:i + batch_size]
        batch_files = []
        for symbol in batch_symbols:
            batch_files.extend(symbol_to_files[symbol])
        batches.append(batch_files)
    
    return batches


def split_train_holdout(
    df: DataFrame,
    time_column: str = "open_time",
    train_ratio: float = 0.9
) -> Tuple[DataFrame, DataFrame]:
    """
    Split DataFrame into train and holdout sets based on time.
    
    This ensures no data leakage by using time-based splitting instead of random.
    The first train_ratio% of time goes to training, last (1-train_ratio)% to holdout.
    
    Args:
        df: Input DataFrame
        time_column: Name of the time column for sorting
        train_ratio: Ratio of data for training (default: 0.9 = 90%)
        
    Returns:
        Tuple of (train_df, holdout_df)
    """
    # Get time boundaries
    time_stats = df.select(
        col(time_column).alias("time")
    ).agg(
        {"time": "min", "time": "max"}
    ).collect()[0]
    
    min_time = time_stats["min(time)"]
    max_time = time_stats["max(time)"]
    split_time = min_time + (max_time - min_time) * train_ratio
    
    # Split based on time threshold
    train_df = df.filter(col(time_column) < split_time)
    holdout_df = df.filter(col(time_column) >= split_time)
    
    return train_df, holdout_df
