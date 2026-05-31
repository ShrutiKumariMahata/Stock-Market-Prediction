# app/model/trainer.py

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR, ReduceLROnPlateau
import numpy as np
import asyncio
import logging
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, Optional
import os
import json
from pathlib import Path

from app.model.lstm_model import LSTMModel, CNNLSTMModel, TransformerModel, get_model
from app.data.fetcher import fetch_stock_data
from app.model.indicators import prepare_training_data

logger = logging.getLogger(__name__)


class StockTrainer:
    """Real stock prediction model trainer"""
    
    def __init__(self, device: Optional[str] = None):
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.training_history = {
            'train_loss': [],
            'val_loss': [],
            'accuracy': [],
            'learning_rates': [],
            'epochs_completed': 0,
            'best_val_loss': float('inf')
        }
        self.is_training = False
        self.stop_training = False
        
        # Create checkpoint directory
        os.makedirs('checkpoints', exist_ok=True)
        
        logger.info(f"Trainer initialized on device: {self.device}")
    
    def initialize_model(self, model_type: str = "lstm_attention", **kwargs):
        """Initialize a new model"""
        self.model = get_model(model_type, **kwargs)
        self.model = self.model.to(self.device)
        
        # Log model info
        total_params = sum(p.numel() for p in self.model.parameters())
        trainable_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
        
        logger.info(f"Model initialized: {model_type}")
        logger.info(f"Total parameters: {total_params:,}")
        logger.info(f"Trainable parameters: {trainable_params:,}")
        
        return {
            "model_type": model_type,
            "total_params": total_params,
            "trainable_params": trainable_params,
            "device": self.device
        }
    
    async def prepare_data(
        self, 
        tickers: list, 
        sequence_length: int = 60,
        test_split: float = 0.2,
        batch_size: int = 32
    ) -> tuple:
        """
        Prepare training data from multiple tickers
        
        Args:
            tickers: List of stock tickers
            sequence_length: LSTM sequence length
            test_split: Validation split ratio
            batch_size: Training batch size
        
        Returns:
            train_loader, val_loader, data_info
        """
        all_X, all_y = [], []
        data_info = {'tickers': {}, 'total_samples': 0}
        
        for ticker in tickers:
            try:
                # Fetch data
                df = fetch_stock_data(ticker, period="2y")
                
                if df is None or df.empty:
                    logger.warning(f"No data for {ticker}, skipping")
                    continue
                
                # Prepare sequences
                X, y = prepare_training_data(df, sequence_length)
                
                if len(X) > 0:
                    all_X.append(X)
                    all_y.append(y)
                    data_info['tickers'][ticker] = len(X)
                    data_info['total_samples'] += len(X)
                    
            except Exception as e:
                logger.error(f"Error preparing data for {ticker}: {e}")
                continue
        
        if not all_X:
            raise ValueError("No training data could be prepared")
        
        # Combine all data
        X_combined = np.concatenate(all_X, axis=0)
        y_combined = np.concatenate(all_y, axis=0)
        
        # Split into train/val
        split_idx = int(len(X_combined) * (1 - test_split))
        X_train, X_val = X_combined[:split_idx], X_combined[split_idx:]
        y_train, y_val = y_combined[:split_idx], y_combined[split_idx:]
        
        # Convert to tensors
        X_train = torch.FloatTensor(X_train)
        y_train = torch.FloatTensor(y_train)
        X_val = torch.FloatTensor(X_val)
        y_val = torch.FloatTensor(y_val)
        
        # Create data loaders
        train_dataset = TensorDataset(X_train, y_train)
        val_dataset = TensorDataset(X_val, y_val)
        
        train_loader = DataLoader(
            train_dataset, 
            batch_size=batch_size, 
            shuffle=True,
            pin_memory=True if self.device == 'cuda' else False
        )
        val_loader = DataLoader(
            val_dataset, 
            batch_size=batch_size, 
            shuffle=False,
            pin_memory=True if self.device == 'cuda' else False
        )
        
        data_info.update({
            'train_samples': len(X_train),
            'val_samples': len(X_val),
            'sequence_length': sequence_length,
            'features': X_train.shape[2],
            'batch_size': batch_size
        })
        
        return train_loader, val_loader, data_info
    
    async def train_stream(
        self,
        tickers: list = None,
        epochs: int = 50,
        batch_size: int = 32,
        learning_rate: float = 0.001,
        sequence_length: int = 60,
        model_type: str = "lstm_attention"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Real training with progress streaming
        
        Args:
            tickers: List of stock tickers (default: popular tech stocks)
            epochs: Number of training epochs
            batch_size: Training batch size
            learning_rate: Initial learning rate
            sequence_length: LSTM sequence length
            model_type: Model architecture type
        
        Yields:
            Training progress updates
        """
        if tickers is None:
            tickers = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'NVDA']
        
        self.is_training = True
        self.stop_training = False
        
        try:
            # Phase 1: Initialization
            yield {
                "type": "init",
                "message": f"🚀 Initializing training pipeline...",
                "timestamp": datetime.now().isoformat()
            }
            
            await asyncio.sleep(0.2)
            
            # Initialize model if not exists
            if self.model is None:
                model_info = self.initialize_model(model_type=model_type)
                yield {
                    "type": "init",
                    "message": f"📊 Model: {model_type.upper()} with {model_info['total_params']:,} parameters",
                    "timestamp": datetime.now().isoformat()
                }
                await asyncio.sleep(0.1)
            
            # Phase 2: Data Preparation
            yield {
                "type": "init",
                "message": f"📥 Fetching data for: {', '.join(tickers[:5])}...",
                "timestamp": datetime.now().isoformat()
            }
            
            train_loader, val_loader, data_info = await self.prepare_data(
                tickers, sequence_length, batch_size=batch_size
            )
            
            yield {
                "type": "init",
                "message": f"✅ Data prepared: {data_info['total_samples']:,} samples from {len(data_info['tickers'])} stocks",
                "timestamp": datetime.now().isoformat(),
                "data_info": data_info
            }
            
            await asyncio.sleep(0.3)
            
            # Phase 3: Training Setup
            criterion = nn.HuberLoss()  # More robust than MSE for stock data
            optimizer = AdamW(
                self.model.parameters(), 
                lr=learning_rate,
                weight_decay=0.01
            )
            scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
            
            yield {
                "type": "init",
                "message": f"⚙️ Optimizer: AdamW | Loss: Huber | Scheduler: CosineAnnealing",
                "timestamp": datetime.now().isoformat()
            }
            
            await asyncio.sleep(0.3)
            
            # Phase 4: Training Loop
            best_val_loss = float('inf')
            patience_counter = 0
            max_patience = 15
            
            for epoch in range(1, epochs + 1):
                if self.stop_training:
                    yield {
                        "type": "stopped",
                        "message": "Training stopped by user",
                        "timestamp": datetime.now().isoformat()
                    }
                    break
                
                # Training phase
                self.model.train()
                train_loss = 0.0
                
                for batch_idx, (data, target) in enumerate(train_loader):
                    data, target = data.to(self.device), target.to(self.device)
                    
                    # Forward pass
                    optimizer.zero_grad()
                    output = self.model(data)
                    loss = criterion(output.squeeze(), target)
                    
                    # Backward pass
                    loss.backward()
                    
                    # Gradient clipping
                    grad_norm = torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(), 
                        max_norm=1.0
                    )
                    
                    optimizer.step()
                    
                    train_loss += loss.item()
                
                avg_train_loss = train_loss / len(train_loader)
                
                # Validation phase
                self.model.eval()
                val_loss = 0.0
                correct_direction = 0
                total_predictions = 0
                
                with torch.no_grad():
                    for data, target in val_loader:
                        data, target = data.to(self.device), target.to(self.device)
                        output = self.model(data)
                        loss = criterion(output.squeeze(), target)
                        val_loss += loss.item()
                        
                        # Calculate direction accuracy
                        if len(target) > 1:
                            pred_direction = torch.sign(output[1:] - output[:-1])
                            true_direction = torch.sign(target[1:] - target[:-1])
                            correct_direction += (pred_direction.squeeze() == true_direction.squeeze()).sum().item()
                            total_predictions += pred_direction.numel()
                
                avg_val_loss = val_loss / len(val_loader)
                direction_accuracy = (correct_direction / total_predictions * 100) if total_predictions > 0 else 0
                
                # Update learning rate
                current_lr = optimizer.param_groups[0]['lr']
                scheduler.step()
                
                # Track best model
                is_best = avg_val_loss < best_val_loss
                if is_best:
                    best_val_loss = avg_val_loss
                    patience_counter = 0
                    
                    # Save checkpoint
                    checkpoint_path = f'checkpoints/best_model_epoch_{epoch}.pt'
                    torch.save({
                        'epoch': epoch,
                        'model_state_dict': self.model.state_dict(),
                        'val_loss': avg_val_loss,
                        'model_type': model_type
                    }, 'checkpoints/best_model.pth')
                    
                    yield {
                        "type": "checkpoint",
                        "message": f"💾 New best model saved → {checkpoint_path}",
                        "timestamp": datetime.now().isoformat()
                    }
                else:
                    patience_counter += 1
                
                # Update history
                self.training_history['train_loss'].append(avg_train_loss)
                self.training_history['val_loss'].append(avg_val_loss)
                self.training_history['accuracy'].append(direction_accuracy)
                self.training_history['learning_rates'].append(current_lr)
                self.training_history['epochs_completed'] = epoch
                self.training_history['best_val_loss'] = best_val_loss
                
                # Yield epoch results
                yield {
                    "type": "epoch",
                    "epoch": epoch,
                    "total": epochs,
                    "train_loss": round(avg_train_loss, 6),
                    "val_loss": round(avg_val_loss, 6),
                    "direction_accuracy": round(direction_accuracy, 2),
                    "lr": f"{current_lr:.2e}",
                    "grad_norm": round(float(grad_norm), 4),
                    "is_best": is_best,
                    "patience": patience_counter,
                    "timestamp": datetime.now().isoformat()
                }
                
                # Early stopping
                if patience_counter >= max_patience:
                    yield {
                        "type": "early_stopping",
                        "message": f"⏹️ Early stopping after {epoch} epochs (no improvement for {max_patience} epochs)",
                        "best_val_loss": round(best_val_loss, 6),
                        "timestamp": datetime.now().isoformat()
                    }
                    break
                
                # Allow other tasks
                await asyncio.sleep(0.01)
            
            # Phase 5: Training Complete
            final_checkpoint = 'checkpoints/model_final.pt'
            torch.save({
                'epoch': self.training_history['epochs_completed'],
                'model_state_dict': self.model.state_dict(),
                'best_val_loss': best_val_loss,
                'training_history': self.training_history,
                'model_type': model_type
            }, final_checkpoint)
            
            yield {
                "type": "completed",
                "message": f"✅ Training complete! Best val_loss: {best_val_loss:.6f}",
                "epochs_completed": self.training_history['epochs_completed'],
                "best_val_loss": round(best_val_loss, 6),
                "final_accuracy": round(self.training_history['accuracy'][-1], 2) if self.training_history['accuracy'] else 0,
                "model_path": final_checkpoint,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Training error: {str(e)}")
            yield {
                "type": "error",
                "message": f"Training failed: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }
        finally:
            self.is_training = False
    
    def load_best_model(self, path: str = None):
        """Load the best saved model"""
        if path is None:
            # Find latest checkpoint
            checkpoints = list(Path('checkpoints').glob('best_model_*.pt'))
            if not checkpoints:
                raise FileNotFoundError("No checkpoint found")
            path = str(max(checkpoints, key=os.path.getmtime))
        
        checkpoint = torch.load(path, map_location=self.device)
        
        if self.model is None:
            model_type = checkpoint.get('model_type', 'lstm_attention')
            self.initialize_model(model_type=model_type)
        
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.eval()
        
        logger.info(f"Loaded model from {path}")
        logger.info(f"Best validation loss: {checkpoint.get('val_loss', 'unknown')}")
        
        return checkpoint


# Global trainer instance
trainer = StockTrainer()