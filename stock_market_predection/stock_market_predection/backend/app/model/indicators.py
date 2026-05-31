import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


def compute_rsi(series: pd.Series, period: int = 14) -> float:
    """
    Calculate Relative Strength Index
    
    RSI = 100 - (100 / (1 + RS))
    where RS = Average Gain / Average Loss
    
    Args:
        series: Price series (typically Close prices)
        period: RSI period (default 14)
    
    Returns:
        RSI value (0-100)
    """
    try:
        # Ensure we have enough data
        if len(series) < period + 1:
            logger.warning(f"Insufficient data for RSI calculation: {len(series)} < {period + 1}")
            return 50.0  # Neutral value
        
        # Calculate price changes
        delta = series.diff()
        
        # Separate gains and losses
        gain = delta.where(delta > 0, 0.0)
        loss = -delta.where(delta < 0, 0.0)
        
        # Calculate average gain and loss using Wilder's smoothing method
        avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()
        
        # Handle division by zero
        avg_loss = avg_loss.replace(0, 1e-10)
        
        # Calculate RS and RSI
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        # Get latest value
        rsi_value = float(rsi.iloc[-1])
        
        # Clip to valid range
        rsi_value = max(0, min(100, rsi_value))
        
        return round(rsi_value, 2)
        
    except Exception as e:
        logger.error(f"Error calculating RSI: {e}")
        return 50.0  # Neutral value on error


def compute_macd(
    series: pd.Series, 
    fast: int = 12, 
    slow: int = 26, 
    signal: int = 9
) -> Dict[str, float]:
    """
    Calculate Moving Average Convergence Divergence
    
    Args:
        series: Price series
        fast: Fast EMA period
        slow: Slow EMA period
        signal: Signal line period
    
    Returns:
        Dictionary with MACD line, signal line, histogram, and signal
    """
    try:
        # Calculate EMAs
        ema_fast = series.ewm(span=fast, adjust=False).mean()
        ema_slow = series.ewm(span=slow, adjust=False).mean()
        
        # MACD line
        macd_line = ema_fast - ema_slow
        
        # Signal line
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        
        # MACD histogram
        histogram = macd_line - signal_line
        
        # Get latest values
        macd_val = round(float(macd_line.iloc[-1]), 4)
        signal_val = round(float(signal_line.iloc[-1]), 4)
        histogram_val = round(float(histogram.iloc[-1]), 4)
        
        # Determine signal
        if macd_line.iloc[-1] > signal_line.iloc[-1]:
            if macd_line.iloc[-2] <= signal_line.iloc[-2]:
                signal_text = "Bullish crossover"
            else:
                signal_text = "Bullish"
        else:
            if macd_line.iloc[-2] >= signal_line.iloc[-2]:
                signal_text = "Bearish crossover"
            else:
                signal_text = "Bearish"
        
        # Check divergence
        price_trend = "up" if series.iloc[-1] > series.iloc[-20] else "down"
        macd_trend = "up" if macd_line.iloc[-1] > macd_line.iloc[-20] else "down"
        
        if price_trend != macd_trend:
            signal_text += " (Divergence detected)"
        
        return {
            "macd_line": macd_val,
            "signal_line": signal_val,
            "histogram": histogram_val,
            "signal": signal_text,
            "trend_strength": abs(histogram_val)
        }
        
    except Exception as e:
        logger.error(f"Error calculating MACD: {e}")
        return {
            "macd_line": 0.0,
            "signal_line": 0.0,
            "histogram": 0.0,
            "signal": "Error",
            "trend_strength": 0.0
        }


def compute_bollinger_bands(
    series: pd.Series, 
    window: int = 20, 
    num_std: float = 2.0
) -> Dict[str, any]:
    """
    Calculate Bollinger Bands
    
    Args:
        series: Price series
        window: Moving average window
        num_std: Number of standard deviations
    
    Returns:
        Dictionary with upper, middle, lower bands and position
    """
    try:
        # Calculate bands
        sma = series.rolling(window=window).mean()
        std = series.rolling(window=window).std()
        
        upper_band = sma + (num_std * std)
        lower_band = sma - (num_std * std)
        
        # Current values
        current_price = series.iloc[-1]
        upper_val = round(float(upper_band.iloc[-1]), 2)
        middle_val = round(float(sma.iloc[-1]), 2)
        lower_val = round(float(lower_band.iloc[-1]), 2)
        
        # Bandwidth (volatility indicator)
        bandwidth = round(((upper_val - lower_val) / middle_val) * 100, 2)
        
        # %B indicator (position within bands)
        percent_b = round((current_price - lower_val) / (upper_val - lower_val), 2) if upper_val != lower_val else 0.5
        
        # Determine position
        if current_price >= upper_val:
            position = "Above upper band"
            strength = "Overbought"
        elif current_price <= lower_val:
            position = "Below lower band"
            strength = "Oversold"
        elif current_price > middle_val:
            position = "Upper half"
            strength = "Bullish"
        else:
            position = "Lower half"
            strength = "Bearish"
        
        return {
            "upper": upper_val,
            "middle": middle_val,
            "lower": lower_val,
            "current_price": current_price,
            "position": position,
            "strength": strength,
            "bandwidth": bandwidth,
            "percent_b": percent_b
        }
        
    except Exception as e:
        logger.error(f"Error calculating Bollinger Bands: {e}")
        return {
            "upper": 0.0,
            "middle": 0.0,
            "lower": 0.0,
            "position": "Error",
            "strength": "Unknown"
        }


def compute_beta(series: pd.Series, market_returns: Optional[pd.Series] = None) -> float:
    """
    Calculate Beta (volatility relative to market)
    
    If market returns not provided, calculates annualized volatility instead
    
    Args:
        series: Price series
        market_returns: Market returns series (optional)
    
    Returns:
        Beta value or annualized volatility
    """
    try:
        # Calculate returns
        returns = series.pct_change().dropna()
        
        if len(returns) < 20:
            return 1.0  # Market average for insufficient data
        
        if market_returns is not None:
            # Calculate beta against market
            covariance = returns.cov(market_returns)
            market_variance = market_returns.var()
            
            if market_variance > 0:
                beta = covariance / market_variance
            else:
                beta = 1.0
        else:
            # Calculate annualized volatility (proxy for beta)
            daily_vol = returns.std()
            annual_vol = daily_vol * np.sqrt(252)
            
            # Convert to beta-like scale (market vol ~20%)
            beta = annual_vol / 0.20
        
        return round(float(np.clip(beta, 0.1, 5.0)), 2)
        
    except Exception as e:
        logger.error(f"Error calculating Beta: {e}")
        return 1.0


def compute_volume_trend(volume: pd.Series, short_window: int = 5, long_window: int = 20) -> Dict[str, any]:
    """
    Analyze volume trends
    
    Args:
        volume: Volume series
        short_window: Short moving average period
        long_window: Long moving average period
    
    Returns:
        Dictionary with volume analysis
    """
    try:
        if len(volume) < long_window:
            return {
                "trend": "Insufficient data",
                "ratio": 1.0,
                "analysis": "Need more data"
            }
        
        # Calculate moving averages
        short_ma = volume.rolling(short_window).mean()
        long_ma = volume.rolling(long_window).mean()
        
        # Current values
        current_vol = float(volume.iloc[-1])
        short_avg = float(short_ma.iloc[-1])
        long_avg = float(long_ma.iloc[-1])
        
        # Volume ratio (current vs long-term average)
        volume_ratio = round(current_vol / long_avg, 2) if long_avg > 0 else 1.0
        
        # Volume trend
        if short_avg > long_avg * 1.1:
            trend = "Increasing"
        elif short_avg < long_avg * 0.9:
            trend = "Decreasing"
        else:
            trend = "Stable"
        
        # Analysis
        if volume_ratio > 2.0:
            analysis = "Unusually high volume"
        elif volume_ratio > 1.5:
            analysis = "Above average volume"
        elif volume_ratio > 0.5:
            analysis = "Normal volume"
        else:
            analysis = "Below average volume"
        
        return {
            "current_volume": current_vol,
            "short_ma": round(short_avg, 0),
            "long_ma": round(long_avg, 0),
            "ratio": volume_ratio,
            "trend": trend,
            "analysis": analysis
        }
        
    except Exception as e:
        logger.error(f"Error calculating Volume Trend: {e}")
        return {
            "trend": "Error",
            "ratio": 1.0,
            "analysis": "Calculation error"
        }


def compute_support_resistance(df: pd.DataFrame, window: int = 20) -> Dict[str, float]:
    """
    Find support and resistance levels
    
    Args:
        df: DataFrame with OHLC data
        window: Window for finding levels
    
    Returns:
        Dictionary with support and resistance levels
    """
    try:
        # Use recent data
        recent = df.tail(window * 2)
        
        # Find local minima and maxima
        highs = recent['High'].values
        lows = recent['Low'].values
        
        # Simple support (recent lows)
        support_1 = float(np.percentile(lows, 10))
        support_2 = float(np.percentile(lows, 5))
        
        # Simple resistance (recent highs)
        resistance_1 = float(np.percentile(highs, 90))
        resistance_2 = float(np.percentile(highs, 95))
        
        current_price = float(recent['Close'].iloc[-1])
        
        return {
            "support_1": round(support_1, 2),
            "support_2": round(support_2, 2),
            "resistance_1": round(resistance_1, 2),
            "resistance_2": round(resistance_2, 2),
            "current_price": current_price,
            "distance_to_support": round(((current_price - support_1) / current_price) * 100, 2),
            "distance_to_resistance": round(((resistance_1 - current_price) / current_price) * 100, 2)
        }
        
    except Exception as e:
        logger.error(f"Error finding support/resistance: {e}")
        return {}


def compute_moving_averages(series: pd.Series, periods: List[int] = [7, 21, 50, 200]) -> Dict[str, float]:
    """
    Calculate multiple moving averages
    
    Args:
        series: Price series
        periods: List of MA periods
    
    Returns:
        Dictionary with MA values and signals
    """
    try:
        mas = {}
        for period in periods:
            if len(series) >= period:
                ma_val = series.rolling(window=period).mean().iloc[-1]
                mas[f"MA_{period}"] = round(float(ma_val), 2)
        
        # Add trend analysis
        current_price = series.iloc[-1]
        
        # Price vs MAs
        above_mas = sum(1 for ma in mas.values() if current_price > ma)
        total_mas = len(mas)
        
        if total_mas > 0:
            if above_mas == total_mas:
                mas["trend"] = "Strongly Bullish"
            elif above_mas > total_mas / 2:
                mas["trend"] = "Bullish"
            elif above_mas < total_mas / 2:
                mas["trend"] = "Bearish"
            else:
                mas["trend"] = "Neutral"
        
        return mas
        
    except Exception as e:
        logger.error(f"Error calculating Moving Averages: {e}")
        return {}


def get_all_indicators(df: pd.DataFrame) -> dict:
    """
    Calculate all technical indicators
    
    Args:
        df: DataFrame with OHLCV data
    
    Returns:
        Dictionary containing all indicators
    """
    try:
        # Ensure we have proper series
        if 'Close' not in df.columns or 'Volume' not in df.columns:
            raise ValueError("DataFrame must have 'Close' and 'Volume' columns")
        
        close = df["Close"].squeeze()
        volume = df["Volume"].squeeze()
        
        # Basic indicators
        indicators = {
            "rsi": compute_rsi(close),
            "macd": compute_macd(close)["signal"],  # For backward compatibility
            "macd_details": compute_macd(close),     # Full MACD data
            "bollinger": compute_bollinger_bands(close)["position"],  # Backward compatible
            "bollinger_details": compute_bollinger_bands(close),      # Full Bollinger data
            "beta": compute_beta(close),
            "volume_trend": compute_volume_trend(volume)["analysis"],  # Backward compatible
            "volume_details": compute_volume_trend(volume),             # Full volume analysis
            "moving_averages": compute_moving_averages(close),
            "support_resistance": compute_support_resistance(df)
        }
        
        # Add overall market sentiment
        signals = []
        
        # RSI signal
        rsi = indicators["rsi"]
        if rsi > 70:
            signals.append("Bearish")
        elif rsi < 30:
            signals.append("Bullish")
        else:
            signals.append("Neutral")
        
        # MACD signal
        if "bullish" in indicators["macd"].lower():
            signals.append("Bullish")
        elif "bearish" in indicators["macd"].lower():
            signals.append("Bearish")
        
        # Overall sentiment
        bullish_count = signals.count("Bullish")
        bearish_count = signals.count("Bearish")
        
        if bullish_count > bearish_count:
            sentiment = "Bullish"
        elif bearish_count > bullish_count:
            sentiment = "Bearish"
        else:
            sentiment = "Neutral"
        
        indicators["market_sentiment"] = sentiment
        
        return indicators
        
    except Exception as e:
        logger.error(f"Error calculating all indicators: {e}")
        raise


def prepare_training_data(df: pd.DataFrame, sequence_length: int = 60) -> Tuple[np.ndarray, np.ndarray]:
    """
    Prepare data for LSTM training
    
    Args:
        df: DataFrame with OHLCV data
        sequence_length: Number of time steps for LSTM
    
    Returns:
        X: Features array (samples, sequence_length, features)
        y: Target array (samples,)
    """
    try:
        # Select features
        feature_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        
        # Ensure all features exist
        for col in feature_cols:
            if col not in df.columns:
                raise ValueError(f"Missing column: {col}")
        
        # Get feature data
        data = df[feature_cols].values
        
        # Normalize data (0-1 range)
        from sklearn.preprocessing import MinMaxScaler
        scaler = MinMaxScaler()
        scaled_data = scaler.fit_transform(data)
        
        # Create sequences
        X, y = [], []
        for i in range(sequence_length, len(scaled_data)):
            X.append(scaled_data[i-sequence_length:i])
            y.append(scaled_data[i, 3])  # Close price index is 3
        
        return np.array(X), np.array(y)
        
    except Exception as e:
        logger.error(f"Error preparing training data: {e}")
        raise