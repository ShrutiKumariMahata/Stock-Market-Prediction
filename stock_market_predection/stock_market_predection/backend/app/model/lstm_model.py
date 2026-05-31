import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Tuple, Dict
import logging
import numpy as np

logger = logging.getLogger(__name__)


class LSTMModel(nn.Module):
    """
    LSTM with Multihead Attention for Stock Price Prediction
    
    Architecture:
    - Stacked LSTM layers for temporal feature extraction
    - Multi-head attention for capturing long-range dependencies
    - Fully connected layers for final prediction
    """
    
    def __init__(
        self, 
        input_size: int = 5,  # Changed from 47 to 5 (OHLCV features)
        hidden_size: int = 128,  # Reduced from 256 (too large for small datasets)
        num_layers: int = 2,     # Reduced from 4 (overfitting risk)
        output_size: int = 1,
        dropout: float = 0.3,
        bidirectional: bool = False
    ):
        super(LSTMModel, self).__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        
        # Input normalization
        self.input_norm = nn.LayerNorm(input_size)
        
        # LSTM Layer
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional
        )
        
        # Adjust hidden size for bidirectional
        lstm_output_size = hidden_size * 2 if bidirectional else hidden_size
        
        # Attention mechanism
        self.attention = nn.MultiheadAttention(
            embed_dim=lstm_output_size,
            num_heads=8,
            dropout=dropout,
            batch_first=True
        )
        
        # Layer normalization after attention
        self.attn_norm = nn.LayerNorm(lstm_output_size)
        
        # Fully connected layers with residual connections
        self.fc1 = nn.Linear(lstm_output_size, 64)
        self.fc2 = nn.Linear(64, 32)
        self.fc3 = nn.Linear(32, output_size)
        
        # Regularization
        self.dropout = nn.Dropout(dropout)
        self.batch_norm1 = nn.BatchNorm1d(64)
        self.batch_norm2 = nn.BatchNorm1d(32)
        
        # Initialize weights
        self._init_weights()
        
    def _init_weights(self):
        """Initialize model weights properly"""
        for name, param in self.lstm.named_parameters():
            if 'weight' in name:
                nn.init.xavier_normal_(param)
            elif 'bias' in name:
                nn.init.constant_(param, 0.0)
        
        for module in [self.fc1, self.fc2, self.fc3]:
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(module.weight)
                nn.init.constant_(module.bias, 0.0)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass
        
        Args:
            x: Input tensor of shape (batch_size, sequence_length, input_size)
        
        Returns:
            Output tensor of shape (batch_size, output_size)
        """
        # Input normalization
        x = self.input_norm(x)
        
        # Initialize hidden state
        batch_size = x.size(0)
        num_directions = 2 if self.bidirectional else 1
        
        h0 = torch.zeros(
            self.num_layers * num_directions, 
            batch_size, 
            self.hidden_size, 
            device=x.device
        )
        c0 = torch.zeros(
            self.num_layers * num_directions, 
            batch_size, 
            self.hidden_size, 
            device=x.device
        )
        
        # LSTM forward
        lstm_out, (h_n, c_n) = self.lstm(x, (h0, c0))
        
        # Multi-head attention
        attn_out, attn_weights = self.attention(lstm_out, lstm_out, lstm_out)
        
        # Residual connection + normalization
        attn_out = self.attn_norm(lstm_out + attn_out)
        
        # Take the last time step
        last_output = attn_out[:, -1, :]
        
        # Fully connected layers with residual connections
        out = self.fc1(last_output)
        out = self.batch_norm1(out) if batch_size > 1 else out
        out = F.relu(out)
        out = self.dropout(out)
        
        out = self.fc2(out)
        out = self.batch_norm2(out) if batch_size > 1 else out
        out = F.relu(out)
        out = self.dropout(out)
        
        # Final output
        out = self.fc3(out)
        
        return out
    
    def predict(
        self, 
        x: torch.Tensor, 
        return_confidence: bool = False
    ) -> Dict[str, any]:
        """
        Make prediction with optional confidence
        
        Args:
            x: Input tensor
            return_confidence: Whether to return confidence metrics
        
        Returns:
            Dictionary with prediction and optional metrics
        """
        self.eval()
        
        with torch.no_grad():
            prediction = self.forward(x)
            
            result = {
                'prediction': prediction.item() if prediction.numel() == 1 else prediction.squeeze().tolist()
            }
            
            if return_confidence:
                # Monte Carlo Dropout for uncertainty estimation
                mc_predictions = []
                self.train()  # Enable dropout for MC sampling
                
                for _ in range(30):  # 30 MC samples
                    mc_pred = self.forward(x)
                    mc_predictions.append(mc_pred.item())
                
                self.eval()  # Back to eval mode
                
                mc_predictions = np.array(mc_predictions)
                result.update({
                    'confidence': round(100 - np.std(mc_predictions) * 100, 2),
                    'prediction_std': round(float(np.std(mc_predictions)), 4),
                    'prediction_mean': round(float(np.mean(mc_predictions)), 4),
                    'lower_bound': round(float(np.percentile(mc_predictions, 5)), 4),
                    'upper_bound': round(float(np.percentile(mc_predictions, 95)), 4)
                })
            
            return result
    
    def get_attention_weights(self, x: torch.Tensor) -> np.ndarray:
        """
        Extract attention weights for interpretability
        
        Args:
            x: Input tensor
        
        Returns:
            Attention weights matrix
        """
        self.eval()
        
        with torch.no_grad():
            # Forward pass to get attention weights
            x = self.input_norm(x)
            h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size, device=x.device)
            c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size, device=x.device)
            
            lstm_out, _ = self.lstm(x, (h0, c0))
            _, attn_weights = self.attention(lstm_out, lstm_out, lstm_out)
            
            return attn_weights.cpu().numpy()


class CNNLSTMModel(nn.Module):
    """
    CNN-LSTM Hybrid Model
    
    CNN extracts local patterns, LSTM captures temporal dependencies
    """
    
    def __init__(
        self, 
        input_size: int = 5,
        hidden_size: int = 64,
        num_layers: int = 2,
        output_size: int = 1,
        dropout: float = 0.3
    ):
        super(CNNLSTMModel, self).__init__()
        
        # CNN layers for feature extraction
        self.conv1 = nn.Conv1d(
            in_channels=input_size,
            out_channels=32,
            kernel_size=3,
            padding=1
        )
        self.conv2 = nn.Conv1d(
            in_channels=32,
            out_channels=64,
            kernel_size=3,
            padding=1
        )
        
        # Batch normalization
        self.bn1 = nn.BatchNorm1d(32)
        self.bn2 = nn.BatchNorm1d(64)
        
        # Pooling
        self.pool = nn.MaxPool1d(kernel_size=2)
        
        # LSTM
        self.lstm = nn.LSTM(
            input_size=64,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        # Fully connected
        self.fc1 = nn.Linear(hidden_size, 32)
        self.fc2 = nn.Linear(32, output_size)
        self.dropout = nn.Dropout(dropout)
        
    def forward(self, x):
        # x shape: (batch, seq_len, features)
        # Reshape for CNN: (batch, features, seq_len)
        x = x.permute(0, 2, 1)
        
        # CNN layers
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.pool(x)
        x = F.relu(self.bn2(self.conv2(x)))
        x = self.pool(x)
        
        # Reshape back for LSTM: (batch, seq_len, features)
        x = x.permute(0, 2, 1)
        
        # LSTM
        lstm_out, _ = self.lstm(x)
        
        # Take last output
        out = lstm_out[:, -1, :]
        out = self.dropout(out)
        
        # Fully connected
        out = F.relu(self.fc1(out))
        out = self.dropout(out)
        out = self.fc2(out)
        
        return out


class TransformerModel(nn.Module):
    """
    Transformer-based model for stock prediction
    """
    
    def __init__(
        self,
        input_size: int = 5,
        d_model: int = 64,
        nhead: int = 4,
        num_layers: int = 3,
        output_size: int = 1,
        dropout: float = 0.2
    ):
        super(TransformerModel, self).__init__()
        
        # Input projection
        self.input_projection = nn.Linear(input_size, d_model)
        
        # Positional encoding
        self.pos_encoder = PositionalEncoding(d_model, dropout)
        
        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dropout=dropout,
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(
            encoder_layer,
            num_layers=num_layers
        )
        
        # Output layers
        self.fc1 = nn.Linear(d_model, 32)
        self.fc2 = nn.Linear(32, output_size)
        self.dropout = nn.Dropout(dropout)
        
    def forward(self, x):
        # Project input to d_model dimensions
        x = self.input_projection(x)
        
        # Add positional encoding
        x = self.pos_encoder(x)
        
        # Transformer
        x = self.transformer(x)
        
        # Global average pooling
        x = x.mean(dim=1)
        
        # Fully connected
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        
        return x


class PositionalEncoding(nn.Module):
    """Positional encoding for Transformer"""
    
    def __init__(self, d_model: int, dropout: float = 0.1, max_len: int = 5000):
        super(PositionalEncoding, self).__init__()
        self.dropout = nn.Dropout(p=dropout)
        
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-np.log(10000.0) / d_model)
        )
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)  # Add batch dimension
        
        self.register_buffer('pe', pe)
        
    def forward(self, x):
        x = x + self.pe[:, :x.size(1), :]
        return self.dropout(x)


def get_model(model_type: str = "lstm_attention", **kwargs) -> nn.Module:
    """
    Factory function to create models
    
    Args:
        model_type: Type of model to create
            - "lstm_attention": LSTM with attention
            - "cnn_lstm": CNN-LSTM hybrid
            - "transformer": Transformer-based
        **kwargs: Model parameters
    
    Returns:
        PyTorch model
    """
    models = {
        "lstm_attention": LSTMModel,
        "cnn_lstm": CNNLSTMModel,
        "transformer": TransformerModel
    }
    
    if model_type not in models:
        raise ValueError(f"Unknown model type: {model_type}. Available: {list(models.keys())}")
    
    model = models[model_type](**kwargs)
    model.eval()
    
    logger.info(f"Created {model_type} model with {sum(p.numel() for p in model.parameters()):,} parameters")
    
    return model


def load_checkpoint(model: nn.Module, path: str, device: str = 'cpu') -> nn.Module:
    """
    Load model checkpoint
    
    Args:
        model: PyTorch model
        path: Path to checkpoint file
        device: Device to load model to
    
    Returns:
        Loaded model
    """
    try:
        checkpoint = torch.load(path, map_location=device)
        
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            model.load_state_dict(checkpoint['model_state_dict'])
            logger.info(f"Loaded checkpoint from epoch {checkpoint.get('epoch', 'unknown')}")
            logger.info(f"Validation loss: {checkpoint.get('val_loss', 'unknown')}")
        else:
            model.load_state_dict(checkpoint)
            logger.info(f"Loaded model weights from {path}")
        
        model = model.to(device)
        model.eval()
        
        return model
        
    except Exception as e:
        logger.error(f"Error loading checkpoint: {e}")
        raise

# Add this at the end of app/model/lstm_model.py

class StockPredictor:
    """
    Wrapper class for stock prediction models
    Provides easy interface for training, prediction, and model management
    """
    
    def __init__(
        self, 
        model_type: str = "lstm_attention",
        model_path: Optional[str] = None,
        device: str = 'cpu',
        **model_kwargs
    ):
        self.model_type = model_type
        self.device = device
        self.model = get_model(model_type=model_type, **model_kwargs)
        self.model = self.model.to(device)
        
        if model_path:
            self.model = load_checkpoint(self.model, model_path, device)
    
    def predict(
        self, 
        data: torch.Tensor, 
        return_confidence: bool = False
    ) -> Dict[str, any]:
        """
        Make predictions using the model
        
        Args:
            data: Input tensor of shape (batch_size, seq_len, features)
            return_confidence: Whether to return confidence metrics
        
        Returns:
            Dictionary with prediction results
        """
        self.model.eval()
        
        with torch.no_grad():
            data = data.to(self.device)
            
            # If model has predict method (LSTMModel), use it
            if hasattr(self.model, 'predict'):
                return self.model.predict(data, return_confidence)
            
            # Otherwise, do standard forward pass
            prediction = self.model(data)
            
            result = {
                'prediction': prediction.item() if prediction.numel() == 1 else prediction.squeeze().tolist()
            }
            
            return result
    
    def train(
        self, 
        train_loader, 
        val_loader=None, 
        epochs: int = 100,
        learning_rate: float = 0.001,
        save_path: Optional[str] = None
    ):
        """
        Train the model
        
        Args:
            train_loader: DataLoader for training data
            val_loader: DataLoader for validation data
            epochs: Number of training epochs
            learning_rate: Learning rate for optimizer
            save_path: Path to save the best model
        """
        self.model.train()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)
        criterion = nn.MSELoss()
        
        best_val_loss = float('inf')
        
        for epoch in range(epochs):
            # Training
            train_loss = 0
            for batch_x, batch_y in train_loader:
                batch_x, batch_y = batch_x.to(self.device), batch_y.to(self.device)
                
                optimizer.zero_grad()
                output = self.model(batch_x)
                loss = criterion(output, batch_y)
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item()
            
            train_loss /= len(train_loader)
            
            # Validation
            if val_loader:
                self.model.eval()
                val_loss = 0
                with torch.no_grad():
                    for batch_x, batch_y in val_loader:
                        batch_x, batch_y = batch_x.to(self.device), batch_y.to(self.device)
                        output = self.model(batch_x)
                        val_loss += criterion(output, batch_y).item()
                val_loss /= len(val_loader)
                self.model.train()
                
                logger.info(f'Epoch {epoch+1}/{epochs} - Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}')
                
                # Save best model
                if save_path and val_loss < best_val_loss:
                    best_val_loss = val_loss
                    torch.save({
                        'epoch': epoch,
                        'model_state_dict': self.model.state_dict(),
                        'optimizer_state_dict': optimizer.state_dict(),
                        'train_loss': train_loss,
                        'val_loss': val_loss,
                    }, save_path)
                    logger.info(f'Saved best model to {save_path}')
            else:
                logger.info(f'Epoch {epoch+1}/{epochs} - Train Loss: {train_loss:.4f}')
    
    def load_model(self, path: str):
        """Load a pre-trained model"""
        self.model = load_checkpoint(self.model, path, self.device)
    
    def save_model(self, path: str):
        """Save the model"""
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'model_type': self.model_type,
        }, path)
        logger.info(f'Model saved to {path}')