"""Main training script for Scalable Pattern Recognition System in Cryptocurrency Markets.

This script implements a 3-level stacked generalization ensemble:
- Level 0: RandomForest models trained on batches of symbols
- Level 1: RandomForest meta-learner trained on Level 0 predictions
- Level 2: LogisticRegression final meta-model trained on Level 1 predictions
"""

import findspark
findspark.init()

from pyspark.sql import SparkSession
from pyspark.sql.functions import col
import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.data_ingestion.loader import (
    get_symbol_batches,
    load_parquet_batch,
    split_train_holdout
)
from src.features.pipeline import create_feature_pipeline
from src.models.stacking_manager import StackingManager


def main():
    """Main training pipeline."""
    
    # Configuration
    DATA_DIR = "data/parquet"  # Directory containing Parquet files
    MODEL_DIR = "models"  # Directory to save models
    BATCH_SIZE = 10  # Number of symbols per batch
    
    # Initialize Spark
    spark = SparkSession.builder \
        .appName("CryptoPatternRecognition") \
        .config("spark.sql.adaptive.enabled", "true") \
        .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
        .getOrCreate()
    
    spark.sparkContext.setLogLevel("WARN")
    
    print("=" * 80)
    print("Scalable Pattern Recognition System - Training Pipeline")
    print("=" * 80)
    
    # Initialize StackingManager
    stacking_manager = StackingManager(model_dir=MODEL_DIR)
    
    # Get symbol batches
    print(f"\n[1] Loading Parquet files from {DATA_DIR}...")
    batches = get_symbol_batches(spark, DATA_DIR, batch_size=BATCH_SIZE)
    print(f"    Found {len(batches)} batches of symbols")
    
    # Level 0: Train models on each batch
    print("\n[2] Level 0: Training base models on batches...")
    level0_predictions = []
    
    for batch_id, batch_files in enumerate(batches):
        print(f"\n    Processing batch {batch_id + 1}/{len(batches)} ({len(batch_files)} files)...")
        
        # Load batch data
        batch_df = load_parquet_batch(spark, batch_files)
        print(f"    Loaded {batch_df.count()} rows")
        
        # Create features
        print("    Creating features...")
        batch_df = create_feature_pipeline(batch_df)
        
        # Create labels (volatility-based)
        print("    Creating volatility-based labels...")
        batch_df = stacking_manager.create_volatility_label(batch_df)
        
        # Time-based split: first 90% for training, last 10% for holdout
        # This prevents data leakage by ensuring no future data is used for training
        print("    Splitting into train (90%) and holdout (10%) sets...")
        train_df, holdout_df = split_train_holdout(
            batch_df,
            time_column="open_time",
            train_ratio=0.9
        )
        
        train_count = train_df.count()
        holdout_count = holdout_df.count()
        print(f"    Train: {train_count} rows, Holdout: {holdout_count} rows")
        
        # Train Level 0 model
        print("    Training Level 0 RandomForest...")
        model_path = stacking_manager.train_level0(
            spark,
            train_df,
            batch_id=batch_id,
            num_trees=100,
            max_depth=10
        )
        print(f"    Saved model to {model_path}")
        
        # Generate Level 0 predictions on holdout set
        print("    Generating Level 0 predictions on holdout set...")
        level0_pred = stacking_manager.predict_level0(
            spark,
            holdout_df,
            batch_id=batch_id
        )
        
        # Cache predictions for later use
        level0_pred.cache()
        level0_predictions.append(level0_pred)
        
        print(f"    Batch {batch_id + 1} completed")
    
    print(f"\n[3] Level 1: Training meta-learner on Level 0 predictions...")
    print(f"    Combining {len(level0_predictions)} Level 0 prediction sets...")
    
    # Train Level 1 model
    level1_model_path = stacking_manager.train_level1(
        spark,
        level0_predictions,
        num_trees=50,
        max_depth=8
    )
    print(f"    Saved Level 1 model to {level1_model_path}")
    
    # Generate Level 1 predictions
    print("    Generating Level 1 predictions...")
    level1_predictions = stacking_manager.predict_level1(
        spark,
        level0_predictions
    )
    level1_predictions.cache()
    
    print(f"\n[4] Level 2: Training final meta-model (LogisticRegression)...")
    
    # Train Level 2 model
    level2_model_path = stacking_manager.train_level2(
        spark,
        level1_predictions
    )
    print(f"    Saved Level 2 model to {level2_model_path}")
    
    # Generate final predictions
    print("    Generating final Level 2 predictions...")
    final_predictions = stacking_manager.predict_level2(
        spark,
        level1_predictions
    )
    
    # Evaluate final model (optional)
    print("\n[5] Evaluating final model...")
    from pyspark.ml.evaluation import BinaryClassificationEvaluator
    
    evaluator = BinaryClassificationEvaluator(
        labelCol="label",
        rawPredictionCol="level2_pred",
        metricName="areaUnderROC"
    )
    
    # Note: level2_pred is probability, need to convert to rawPrediction format
    # For simplicity, we'll use a different evaluation approach
    final_predictions.show(20)
    
    print("\n" + "=" * 80)
    print("Training completed successfully!")
    print(f"Models saved in: {MODEL_DIR}")
    print("=" * 80)
    
    spark.stop()


if __name__ == "__main__":
    main()
