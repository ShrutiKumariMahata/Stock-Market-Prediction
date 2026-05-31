import yfinance as yf
import pandas as pd
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Union
import json
import hashlib
from functools import lru_cache

logger = logging.getLogger(__name__)

# Configuration
CACHE_DIR = "dataset"
CACHE_EXPIRY_HOURS = 1  # Cache expiry time for different periods
CACHE_EXPIRY = {
    "1d": 0.5,     # 30 minutes
    "5d": 1,       # 1 hour
    "1mo": 6,      # 6 hours
    "3mo": 12,     # 12 hours
    "6mo": 24,     # 1 day
    "1y": 48,      # 2 days
    "2y": 72,      # 3 days
    "5y": 168,     # 1 week
    "max": 720     # 30 days
}

# Create cache directory if it doesn't exist
os.makedirs(CACHE_DIR, exist_ok=True)


def fetch_stock_data(
    ticker: str, 
    period: str = "1mo",
    interval: str = "1d",
    use_cache: bool = True,
    force_refresh: bool = False
) -> pd.DataFrame:
    """
    Fetch stock data with intelligent caching
    
    Args:
        ticker: Stock symbol (e.g., 'AAPL', 'RELIANCE.NS')
        period: Time period ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max')
        interval: Data interval ('1d', '1h', '30m', '15m', '5m', '1m')
        use_cache: Whether to use cached data
        force_refresh: Force download even if cache exists
    
    Returns:
        DataFrame with OHLCV data
    
    Raises:
        ValueError: If no data found or invalid parameters
        ConnectionError: If yfinance API fails
    """
    # Validate inputs
    ticker = ticker.upper().strip()
    
    if not ticker:
        raise ValueError("Ticker symbol cannot be empty")
    
    valid_periods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max']
    if period not in valid_periods:
        raise ValueError(f"Invalid period. Must be one of {valid_periods}")
    
    # Generate cache key
    cache_key = f"{ticker}_{period}_{interval}"
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.csv")
    meta_file = os.path.join(CACHE_DIR, f"{cache_key}_meta.json")
    
    # Check cache
    if use_cache and not force_refresh and os.path.exists(cache_file):
        # Check if cache is expired
        if os.path.exists(meta_file):
            with open(meta_file, 'r') as f:
                meta = json.load(f)
            
            cache_time = datetime.fromisoformat(meta.get('timestamp', '2000-01-01'))
            expiry_hours = CACHE_EXPIRY.get(period, 24)
            
            if datetime.now() - cache_time < timedelta(hours=expiry_hours):
                try:
                    df = pd.read_csv(cache_file, index_col=0, parse_dates=True)
                    
                    # Validate cached data
                    if not df.empty and all(col in df.columns for col in ['Open', 'High', 'Low', 'Close', 'Volume']):
                        logger.info(f"Using cached data for {ticker} ({period})")
                        return df
                    else:
                        logger.warning(f"Cached data for {ticker} is invalid, re-fetching")
                except Exception as e:
                    logger.warning(f"Failed to read cache for {ticker}: {e}")
    
    # Fetch fresh data
    try:
        logger.info(f"Fetching fresh data for {ticker} ({period})")
        
        ticker_obj = yf.Ticker(ticker)
        
        # Validate ticker exists
        info = ticker_obj.info
        if not info or info.get('regularMarketPrice') is None and info.get('previousClose') is None:
            # Try with history to confirm
            test_df = ticker_obj.history(period="5d")
            if test_df.empty:
                raise ValueError(f"No data found for ticker: {ticker}. Please check the symbol.")
        
        # Fetch history
        df = ticker_obj.history(period=period, interval=interval)
        
        if df.empty:
            raise ValueError(f"No data returned for {ticker} with period={period}")
        
        # Data validation and cleaning
        df = clean_stock_data(df)
        
        # Add metadata
        df.attrs['ticker'] = ticker
        df.attrs['period'] = period
        df.attrs['interval'] = interval
        df.attrs['fetch_date'] = datetime.now().isoformat()
        
        # Save to cache
        if use_cache:
            os.makedirs(CACHE_DIR, exist_ok=True)
            df.to_csv(cache_file)
            
            # Save metadata
            meta = {
                'ticker': ticker,
                'period': period,
                'interval': interval,
                'timestamp': datetime.now().isoformat(),
                'rows': len(df),
                'date_range': {
                    'start': df.index[0].isoformat(),
                    'end': df.index[-1].isoformat()
                }
            }
            with open(meta_file, 'w') as f:
                json.dump(meta, f)
            
            logger.info(f"Cached data for {ticker} ({period}) - {len(df)} rows")
        
        return df
        
    except ValueError as e:
        logger.error(f"Validation error for {ticker}: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to fetch data for {ticker}: {e}")
        raise ConnectionError(f"Failed to fetch stock data: {str(e)}")


def clean_stock_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and validate stock data
    
    Args:
        df: Raw DataFrame from yfinance
    
    Returns:
        Cleaned DataFrame
    """
    # Make a copy to avoid warnings
    df = df.copy()
    
    # Remove rows with all NaN values
    df = df.dropna(how='all')
    
    # Forward fill missing values (for weekends/holidays)
    df = df.ffill()
    
    # Ensure price logic is valid
    df = df[df['High'] >= df['Low']]  # High must be >= Low
    
    # Remove rows with zero volume (might be errors)
    df = df[df['Volume'] > 0]
    
    # Sort by date (ascending)
    df = df.sort_index()
    
    # Remove duplicate indices
    df = df[~df.index.duplicated(keep='first')]
    
    return df


def fetch_current_price(ticker: str, use_cache: bool = True) -> float:
    """
    Fetch current/latest stock price
    
    Args:
        ticker: Stock symbol
        use_cache: Use cached data if available
    
    Returns:
        Current price as float
    """
    ticker = ticker.upper().strip()
    
    try:
        # Try getting from 1-day data first (more reliable)
        df = fetch_stock_data(ticker, period="1d", use_cache=use_cache)
        
        if not df.empty:
            current_price = float(df["Close"].iloc[-1])
            return round(current_price, 2)
        
        # Fallback: use fast_info
        ticker_obj = yf.Ticker(ticker)
        current_price = ticker_obj.fast_info.get('lastPrice')
        
        if current_price:
            return round(float(current_price), 2)
        
        # Last resort: use info
        info = ticker_obj.info
        current_price = info.get('regularMarketPrice') or info.get('currentPrice')
        
        if current_price:
            return round(float(current_price), 2)
        
        raise ValueError(f"Could not fetch current price for {ticker}")
        
    except Exception as e:
        logger.error(f"Error fetching current price for {ticker}: {e}")
        raise ValueError(f"Could not fetch price for {ticker}: {str(e)}")


def fetch_multiple_stocks(
    tickers: List[str], 
    period: str = "1mo",
    interval: str = "1d"
) -> Dict[str, pd.DataFrame]:
    """
    Fetch data for multiple stocks
    
    Args:
        tickers: List of stock symbols
        period: Time period
        interval: Data interval
    
    Returns:
        Dictionary mapping ticker to DataFrame
    """
    result = {}
    failed = []
    
    for ticker in tickers:
        try:
            result[ticker] = fetch_stock_data(ticker, period, interval)
        except Exception as e:
            logger.error(f"Failed to fetch {ticker}: {e}")
            failed.append(ticker)
            result[ticker] = pd.DataFrame()  # Empty DataFrame for failed stocks
    
    if failed:
        logger.warning(f"Failed to fetch data for: {failed}")
    
    return result


def fetch_stock_info(ticker: str) -> Dict:
    """
    Fetch detailed stock/company information
    
    Args:
        ticker: Stock symbol
    
    Returns:
        Dictionary with company information
    """
    ticker = ticker.upper().strip()
    
    try:
        ticker_obj = yf.Ticker(ticker)
        info = ticker_obj.info
        
        # Extract relevant information
        return {
            'longName': info.get('longName', 'N/A'),
            'shortName': info.get('shortName', ticker),
            'sector': info.get('sector', 'N/A'),
            'industry': info.get('industry', 'N/A'),
            'marketCap': info.get('marketCap'),
            'trailingPE': info.get('trailingPE'),
            'forwardPE': info.get('forwardPE'),
            'dividendYield': info.get('dividendYield'),
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh'),
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow'),
            'fiftyDayAverage': info.get('fiftyDayAverage'),
            'twoHundredDayAverage': info.get('twoHundredDayAverage'),
            'currency': info.get('currency', 'USD'),
            'exchange': info.get('exchange', 'N/A'),
            'country': info.get('country', 'N/A'),
            'website': info.get('website', 'N/A'),
            'description': info.get('longBusinessSummary', 'N/A')[:500]  # Truncate
        }
        
    except Exception as e:
        logger.error(f"Error fetching info for {ticker}: {e}")
        return {'longName': ticker, 'sector': 'N/A', 'industry': 'N/A'}


def download_and_cache_tickers(
    tickers: List[str], 
    period: str = "5y",
    interval: str = "1d"
) -> None:
    """
    Pre-download and cache data for multiple tickers
    
    Args:
        tickers: List of ticker symbols
        period: Time period to download
        interval: Data interval
    """
    total = len(tickers)
    
    for idx, ticker in enumerate(tickers, 1):
        try:
            logger.info(f"Downloading {ticker} ({idx}/{total})")
            fetch_stock_data(ticker, period=period, interval=interval, force_refresh=True)
            print(f"✅ Cached {ticker} ({idx}/{total})")
        except Exception as e:
            print(f"❌ Failed to cache {ticker}: {e}")


def get_cache_stats() -> Dict:
    """
    Get cache statistics
    """
    if not os.path.exists(CACHE_DIR):
        return {'exists': False, 'files': 0, 'size_mb': 0}
    
    cache_files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.csv')]
    total_size = sum(
        os.path.getsize(os.path.join(CACHE_DIR, f)) 
        for f in cache_files
    ) / (1024 * 1024)  # Convert to MB
    
    # Group by ticker
    tickers = set()
    for f in cache_files:
        ticker = f.split('_')[0]
        tickers.add(ticker)
    
    return {
        'exists': True,
        'files': len(cache_files),
        'size_mb': round(total_size, 2),
        'unique_tickers': len(tickers),
        'tickers': list(tickers),
        'cache_dir': os.path.abspath(CACHE_DIR)
    }


def clear_cache(ticker: Optional[str] = None, older_than_hours: Optional[int] = None):
    """
    Clear cache for specific ticker or all expired caches
    
    Args:
        ticker: Clear cache for specific ticker (None = all)
        older_than_hours: Clear files older than specified hours
    """
    if not os.path.exists(CACHE_DIR):
        return
    
    deleted = 0
    
    for filename in os.listdir(CACHE_DIR):
        filepath = os.path.join(CACHE_DIR, filename)
        
        # Check if file matches criteria
        if ticker and not filename.startswith(ticker):
            continue
        
        if older_than_hours:
            file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
            if datetime.now() - file_time < timedelta(hours=older_than_hours):
                continue
        
        try:
            os.remove(filepath)
            deleted += 1
            logger.info(f"Deleted cache: {filename}")
        except Exception as e:
            logger.error(f"Failed to delete {filename}: {e}")
    
    return {'deleted_files': deleted}


# For backward compatibility
def fetch_5y_and_cache(tickers: list):
    """Deprecated: Use download_and_cache_tickers instead"""
    logger.warning("fetch_5y_and_cache is deprecated, use download_and_cache_tickers")
    download_and_cache_tickers(tickers, period="5y")