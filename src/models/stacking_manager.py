"""Stacked Generalization (Stacking) Manager for 3-level ensemble learning."""

import os
from typing import List, Dict, Tuple
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import col, when, isnan, isnull, lead, Window, abs as spark_abs
from pyspark.ml.classification import RandomForestClassifier, LogisticRegression
from pyspark.ml import Pipeline
from pyspark.ml.feature import VectorAssembler


class StackingManager:
    """
    Manages 3-level stacked generalization ensemble:
    - Level 0: Base models (RandomForest) trained on batches
    - Level 1: Meta-learner (RandomForest) trained on Level 0 predictions
    - Level 2: Final meta-learner (LogisticRegression) trained on Level 1 predictions
    """
    
    def __init__(self, model_dir: str = "models"):
        """
        Initialize StackingManager.
        
        Args:
            model_dir: Directory to save/load models
        """
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        self.level0_models = []
        self.level1_model = None
        self.level2_model = None
    
    def create_volatility_label(
        self,
        df: DataFrame,
        price_column: str = "close",
        threshold_percentile: float = 0.7
    ) -> DataFrame:
        """
        Create volatility-based labels for short-term price movement prediction.
        
        Labels are based on future volatility: high volatility = 1, low = 0.
        This is a proxy for predicting short-term price movements.
        
        Args:
            df: Input DataFrame with price data
            price_column: Name of price column (default: "close")
            threshold_percentile: Percentile threshold for high volatility (default: 0.7)
            
        Returns:
            DataFrame with 'label' column added
        """
        # Calculate forward-looking return (next period's return)
        window_spec = Window.partitionBy("symbol").orderBy("open_time")
        df = df.withColumn("next_close", lead("close", 1).over(window_spec))
        df = df.withColumn(
            "future_return",
            spark_abs((col("next_close") - col("close")) / col("close"))
        )
        
        # Calculate threshold based on percentile
        threshold_value = df.approxQuantile("future_return", [threshold_percentile], 0.1)[0]
        
        # Create binary label: 1 for high volatility, 0 for low
        df = df.withColumn(
            "label",
            when(col("future_return") >= threshold_value, 1.0).otherwise(0.0)
        )
        
        # Drop helper columns
        df = df.drop("next_close", "future_return")
        
        # Fill null labels (last row of each symbol) with 0
        df = df.withColumn(
            "label",
            when(isnull(col("label")), 0.0).otherwise(col("label"))
        )
        
        return df
    
    def train_level0(
        self,
        spark: SparkSession,
        train_df: DataFrame,
        batch_id: int,
        num_trees: int = 100,
        max_depth: int = 10
    ) -> str:
        """
        Train Level 0 RandomForest model on a batch of symbols.
        
        Args:
            spark: SparkSession instance
            train_df: Training DataFrame with features and labels
            batch_id: Unique identifier for this batch
            num_trees: Number of trees in RandomForest (default: 100)
            max_depth: Maximum depth of trees (default: 10)
            
        Returns:
            Path to saved model
        """
        # Filter out rows with null labels
        train_df = train_df.filter(col("label").isNotNull())
        
        # Train RandomForest classifier
        rf = RandomForestClassifier(
            featuresCol="features",
            labelCol="label",
            numTrees=num_trees,
            maxDepth=max_depth,
            seed=42
        )
        
        # Fit the model
        model = rf.fit(train_df)
        
        # Save model
        model_path = os.path.join(self.model_dir, f"level0_batch_{batch_id}")
        model.write().overwrite().save(model_path)
        
        self.level0_models.append(model_path)
        
        return model_path
    
    def predict_level0(
        self,
        spark: SparkSession,
        holdout_df: DataFrame,
        batch_id: int
    ) -> DataFrame:
        """
        Generate Level 0 predictions on holdout set.
        
        Args:
            spark: SparkSession instance
            holdout_df: Holdout DataFrame with features
            batch_id: Batch identifier to load corresponding model
            
        Returns:
            DataFrame with Level 0 predictions added as 'level0_pred' column
        """
        from pyspark.ml.classification import RandomForestClassificationModel
        
        # Load model
        model_path = os.path.join(self.model_dir, f"level0_batch_{batch_id}")
        model = RandomForestClassificationModel.load(model_path)
        
        # Generate predictions
        predictions = model.transform(holdout_df)
        
        # Extract probability of class 1 (high volatility)
        # The probability column contains a vector [prob_class_0, prob_class_1]
        from pyspark.ml.functions import vector_to_array
        from pyspark.sql.functions import element_at
        
        predictions = predictions.withColumn(
            "prob_array",
            vector_to_array(col("probability"))
        )
        predictions = predictions.withColumn(
            "level0_pred",
            element_at(col("prob_array"), 2)  # Probability of class 1
        )
        
        # Select relevant columns
        predictions = predictions.select(
            "symbol", "open_time", "label", "level0_pred", "features"
        )
        
        return predictions
    
    def train_level1(
        self,
        spark: SparkSession,
        level0_predictions: List[DataFrame],
        num_trees: int = 50,
        max_depth: int = 8
    ) -> str:
        """
        Train Level 1 RandomForest on Level 0 predictions.
        
        Args:
            spark: SparkSession instance
            level0_predictions: List of DataFrames with Level 0 predictions
            num_trees: Number of trees in RandomForest (default: 50)
            max_depth: Maximum depth of trees (default: 8)
            
        Returns:
            Path to saved model
        """
        # Combine all Level 0 predictions
        # Group by symbol and open_time, then collect all level0_pred values
        combined = level0_predictions[0]
        
        for i, pred_df in enumerate(level0_predictions[1:], 1):
            combined = combined.join(
                pred_df.select("symbol", "open_time", col("level0_pred").alias(f"level0_pred_{i}")),
                on=["symbol", "open_time"],
                how="inner"
            )
        
        # Rename first level0_pred column
        combined = combined.withColumnRenamed("level0_pred", "level0_pred_0")
        
        # Get all level0 prediction columns
        level0_cols = [col for col in combined.columns if col.startswith("level0_pred_")]
        
        # Create feature vector from Level 0 predictions
        assembler = VectorAssembler(
            inputCols=level0_cols,
            outputCol="level1_features"
        )
        
        combined = assembler.transform(combined)
        
        # Filter out null labels
        combined = combined.filter(col("label").isNotNull())
        
        # Train RandomForest on Level 1 features
        rf = RandomForestClassifier(
            featuresCol="level1_features",
            labelCol="label",
            numTrees=num_trees,
            maxDepth=max_depth,
            seed=42
        )
        
        model = rf.fit(combined)
        
        # Save model
        model_path = os.path.join(self.model_dir, "level1_model")
        model.write().overwrite().save(model_path)
        
        self.level1_model = model_path
        
        return model_path
    
    def predict_level1(
        self,
        spark: SparkSession,
        level0_predictions: List[DataFrame]
    ) -> DataFrame:
        """
        Generate Level 1 predictions from Level 0 predictions.
        
        Args:
            spark: SparkSession instance
            level0_predictions: List of DataFrames with Level 0 predictions
            
        Returns:
            DataFrame with Level 1 predictions added as 'level1_pred' column
        """
        from pyspark.ml.classification import RandomForestClassificationModel
        from pyspark.ml.functions import vector_to_array
        from pyspark.sql.functions import element_at
        
        # Combine Level 0 predictions (same logic as training)
        combined = level0_predictions[0]
        
        for i, pred_df in enumerate(level0_predictions[1:], 1):
            combined = combined.join(
                pred_df.select("symbol", "open_time", col("level0_pred").alias(f"level0_pred_{i}")),
                on=["symbol", "open_time"],
                how="inner"
            )
        
        combined = combined.withColumnRenamed("level0_pred", "level0_pred_0")
        
        # Get all level0 prediction columns
        level0_cols = [col for col in combined.columns if col.startswith("level0_pred_")]
        
        # Create feature vector
        assembler = VectorAssembler(
            inputCols=level0_cols,
            outputCol="level1_features"
        )
        
        combined = assembler.transform(combined)
        
        # Load and apply Level 1 model
        model = RandomForestClassificationModel.load(self.level1_model)
        predictions = model.transform(combined)
        
        # Extract probability of class 1
        predictions = predictions.withColumn(
            "prob_array",
            vector_to_array(col("probability"))
        )
        predictions = predictions.withColumn(
            "level1_pred",
            element_at(col("prob_array"), 2)
        )
        
        return predictions.select("symbol", "open_time", "label", "level1_pred")
    
    def train_level2(
        self,
        spark: SparkSession,
        level1_predictions: DataFrame
    ) -> str:
        """
        Train Level 2 LogisticRegression meta-model on Level 1 predictions.
        
        Args:
            spark: SparkSession instance
            level1_predictions: DataFrame with Level 1 predictions
            
        Returns:
            Path to saved model
        """
        # Create feature vector from Level 1 prediction
        # For simplicity, we use the single level1_pred as feature
        # In practice, you might want to include additional features
        assembler = VectorAssembler(
            inputCols=["level1_pred"],
            outputCol="level2_features"
        )
        
        level1_df = assembler.transform(level1_predictions)
        
        # Filter out null labels
        level1_df = level1_df.filter(col("label").isNotNull())
        
        # Train LogisticRegression meta-model
        lr = LogisticRegression(
            featuresCol="level2_features",
            labelCol="label",
            maxIter=100,
            regParam=0.01,
            elasticNetParam=0.5
        )
        
        model = lr.fit(level1_df)
        
        # Save model
        model_path = os.path.join(self.model_dir, "level2_model")
        model.write().overwrite().save(model_path)
        
        self.level2_model = model_path
        
        return model_path
    
    def predict_level2(
        self,
        spark: SparkSession,
        level1_predictions: DataFrame
    ) -> DataFrame:
        """
        Generate final Level 2 predictions from Level 1 predictions.
        
        Args:
            spark: SparkSession instance
            level1_predictions: DataFrame with Level 1 predictions
            
        Returns:
            DataFrame with final Level 2 predictions
        """
        from pyspark.ml.classification import LogisticRegressionModel
        from pyspark.ml.functions import vector_to_array
        from pyspark.sql.functions import element_at
        
        # Create feature vector
        assembler = VectorAssembler(
            inputCols=["level1_pred"],
            outputCol="level2_features"
        )
        
        level1_df = assembler.transform(level1_predictions)
        
        # Load and apply Level 2 model
        model = LogisticRegressionModel.load(self.level2_model)
        predictions = model.transform(level1_df)
        
        # Extract probability of class 1
        predictions = predictions.withColumn(
            "prob_array",
            vector_to_array(col("probability"))
        )
        predictions = predictions.withColumn(
            "level2_pred",
            element_at(col("prob_array"), 2)
        )
        
        return predictions.select("symbol", "open_time", "label", "level2_pred")
