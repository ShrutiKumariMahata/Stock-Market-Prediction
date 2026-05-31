from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from enum import Enum


class PeriodEnum(str, Enum):
    """Valid time periods for stock data"""
    ONE_DAY = "1d"
    FIVE_DAYS = "5d"
    ONE_MONTH = "1mo"
    THREE_MONTHS = "3mo"
    SIX_MONTHS = "6mo"
    ONE_YEAR = "1y"
    TWO_YEARS = "2y"
    FIVE_YEARS = "5y"
    MAX = "max"


class IntervalEnum(str, Enum):
    """Valid data intervals"""
    DAILY = "1d"
    HOURLY = "1h"
    MINUTE_30 = "30m"
    MINUTE_15 = "15m"
    MINUTE_5 = "5m"
    MINUTE_1 = "1m"


# ==================== Request Schemas ====================

class StockDataRequest(BaseModel):
    """Request for stock historical data"""
    ticker: str = Field(
        ..., 
        min_length=1, 
        max_length=10,
        description="Stock ticker symbol",
        example="AAPL"
    )
    period: str = Field(
        default="1mo",
        description="Time period for data",
        pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|max)$",  # ← pattern NOT regex
        example="6mo"
    )
    interval: str = Field(
        default="1d",
        description="Data interval",
        pattern="^(1d|1h|30m|15m|5m|1m)$"
    )
    include_indicators: bool = Field(
        default=False,
        description="Include technical indicators"
    )
    include_info: bool = Field(
        default=False,
        description="Include company information"
    )
    
    @validator('ticker')
    def validate_ticker(cls, v):
        """Clean ticker symbol"""
        v = v.upper().strip()
        if not v:
            raise ValueError('Ticker cannot be empty')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "ticker": "AAPL",
                "period": "6mo",
                "interval": "1d",
                "include_indicators": True,
                "include_info": True
            }
        }


class StockInfoRequest(BaseModel):
    """Request for stock company information"""
    ticker: str = Field(..., min_length=1, max_length=10)


class StockCompareRequest(BaseModel):
    """Request to compare multiple stocks"""
    tickers: List[str] = Field(
        ..., 
        min_items=1, 
        max_items=5,
        description="List of stock tickers to compare"
    )
    period: str = Field(default="1mo")
    metrics: List[str] = Field(
        default=["price", "volume"],
        description="Metrics to compare"
    )
    
    @validator('tickers')
    def clean_tickers(cls, v):
        return [ticker.upper().strip() for ticker in v]


# ==================== Data Records ====================

class OHLCVRecord(BaseModel):
    """Single OHLCV data point"""
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    open: float = Field(..., ge=0, description="Opening price")
    high: float = Field(..., ge=0, description="Highest price")
    low: float = Field(..., ge=0, description="Lowest price")
    close: float = Field(..., ge=0, description="Closing price")
    volume: int = Field(..., ge=0, description="Trading volume")
    adjusted_close: Optional[float] = Field(
        default=None, 
        ge=0,
        description="Adjusted closing price"
    )
    
    @validator('high')
    def high_must_be_max(cls, v, values):
        """Validate high is highest price"""
        if 'low' in values and v < values['low']:
            raise ValueError('High price must be >= Low price')
        return v
    
    @validator('low')
    def low_must_be_min(cls, v, values):
        """Validate low is lowest price"""
        if 'high' in values and v > values['high']:
            raise ValueError('Low price must be <= High price')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "date": "2024-01-15",
                "open": 175.50,
                "high": 178.20,
                "low": 174.80,
                "close": 177.30,
                "volume": 52456789,
                "adjusted_close": 177.30
            }
        }


class StockStats(BaseModel):
    """Stock statistical summary"""
    mean: float
    median: float
    std: float
    min: float
    max: float
    q1: float  # 25th percentile
    q3: float  # 75th percentile
    skewness: Optional[float] = None
    kurtosis: Optional[float] = None


# ==================== Company Information ====================

class CompanyInfo(BaseModel):
    """Company/Stock detailed information"""
    name: str
    symbol: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    
    # Market data
    market_cap: Optional[float] = Field(default=None, description="Market capitalization")
    enterprise_value: Optional[float] = None
    shares_outstanding: Optional[int] = None
    
    # Financial ratios
    pe_ratio: Optional[float] = Field(default=None, description="P/E Ratio")
    forward_pe: Optional[float] = None
    peg_ratio: Optional[float] = None
    price_to_book: Optional[float] = None
    price_to_sales: Optional[float] = None
    
    # Dividends
    dividend_yield: Optional[float] = None
    dividend_rate: Optional[float] = None
    payout_ratio: Optional[float] = None
    
    # Price information
    current_price: float
    previous_close: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    fifty_day_average: Optional[float] = None
    two_hundred_day_average: Optional[float] = None
    
    # Returns
    ytd_return: Optional[float] = None
    three_month_return: Optional[float] = None
    one_year_return: Optional[float] = None
    three_year_return: Optional[float] = None
    five_year_return: Optional[float] = None
    
    # Volatility
    beta: Optional[float] = None
    volatility: Optional[float] = None
    
    # Metadata
    currency: str = "USD"
    exchange: Optional[str] = None
    last_updated: str = Field(
        default_factory=lambda: datetime.now().isoformat()
    )


# ==================== Response Schemas ====================

class StockMetadata(BaseModel):
    """Metadata about the stock data"""
    ticker: str
    period: str
    interval: str
    currency: str = "USD"
    
    # Date range
    data_start: Optional[str] = None
    data_end: Optional[str] = None
    trading_days: int
    
    # Data quality
    total_records: int
    missing_values: int = 0
    data_completeness: float = 100.0
    
    # Price statistics
    price_summary: Optional[StockStats] = None
    volume_summary: Optional[StockStats] = None
    
    # Fetch metadata
    fetched_at: str = Field(
        default_factory=lambda: datetime.now().isoformat()
    )
    data_source: str = "Yahoo Finance"
    cache_hit: bool = False


class StockDataResponse(BaseModel):
    """Complete stock data response"""
    # Basic info
    ticker: str
    period: str
    
    # The actual data
    data: List[OHLCVRecord]
    total_records: int
    
    # Metadata
    metadata: Optional[StockMetadata] = None
    
    # Optional additions
    company_info: Optional[CompanyInfo] = None
    statistics: Optional[StockStats] = None
    
    # For the response to also serve as a lightweight wrapper
    class Config:
        schema_extra = {
            "example": {
                "ticker": "AAPL",
                "period": "1mo",
                "total_records": 22,
                "data": [
                    {
                        "date": "2024-01-15",
                        "open": 175.50,
                        "high": 178.20,
                        "low": 174.80,
                        "close": 177.30,
                        "volume": 52456789
                    }
                ],
                "metadata": {
                    "ticker": "AAPL",
                    "period": "1mo",
                    "interval": "1d",
                    "trading_days": 22,
                    "total_records": 22,
                    "data_completeness": 100.0,
                    "data_source": "Yahoo Finance",
                    "fetched_at": "2024-01-16T10:30:00"
                }
            }
        }


class StockInfoResponse(BaseModel):
    """Stock information response"""
    ticker: str
    company_info: CompanyInfo
    current_price: float
    recent_performance: Optional[Dict[str, float]] = None
    

class StockCompareResponse(BaseModel):
    """Stock comparison response"""
    tickers: List[str]
    period: str
    comparison: Dict[str, StockDataResponse]
    correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None
    summary: Optional[str] = None


class MarketOverview(BaseModel):
    """Market overview response"""
    timestamp: str = Field(
        default_factory=lambda: datetime.now().isoformat()
    )
    indices: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="Major market indices data"
    )
    top_gainers: List[Dict[str, Any]] = []
    top_losers: List[Dict[str, Any]] = []
    most_active: List[Dict[str, Any]] = []
    market_sentiment: Optional[str] = None


class CacheStatsResponse(BaseModel):
    """Cache statistics response"""
    exists: bool
    files: int
    size_mb: float
    unique_tickers: int
    tickers: List[str]
    cache_directory: str
    last_cleaned: Optional[str] = None


# ==================== Helper Functions ====================

def create_stock_response(
    ticker: str,
    period: str,
    df,
    include_metadata: bool = True
) -> StockDataResponse:
    """
    Helper function to create StockDataResponse from DataFrame
    
    Args:
        ticker: Stock symbol
        period: Time period
        df: DataFrame with stock data
        include_metadata: Whether to include metadata
    
    Returns:
        StockDataResponse object
    """
    records = []
    
    df_reset = df.reset_index()
    
    for _, row in df_reset.iterrows():
        try:
            record = OHLCVRecord(
                date=str(row.iloc[0])[:10],
                open=round(float(row["Open"]), 2),
                high=round(float(row["High"]), 2),
                low=round(float(row["Low"]), 2),
                close=round(float(row["Close"]), 2),
                volume=int(row["Volume"]),
                adjusted_close=round(float(row.get("Adj Close", row["Close"])), 2)
            )
            records.append(record)
        except Exception:
            continue
    
    response = StockDataResponse(
        ticker=ticker,
        period=period,
        data=records,
        total_records=len(records)
    )
    
    if include_metadata and records:
        prices = [r.close for r in records]
        volumes = [r.volume for r in records]
        
        response.metadata = StockMetadata(
            ticker=ticker,
            period=period,
            interval="1d",
            data_start=records[0].date,
            data_end=records[-1].date,
            trading_days=len(records),
            total_records=len(records),
            price_summary=StockStats(
                mean=round(sum(prices)/len(prices), 2),
                median=round(sorted(prices)[len(prices)//2], 2),
                std=round(pd.Series(prices).std(), 2) if len(prices) > 1 else 0,
                min=min(prices),
                max=max(prices),
                q1=round(pd.Series(prices).quantile(0.25), 2),
                q3=round(pd.Series(prices).quantile(0.75), 2)
            ),
            volume_summary=StockStats(
                mean=round(sum(volumes)/len(volumes)),
                median=round(sorted(volumes)[len(volumes)//2]),
                std=round(pd.Series(volumes).std(), 2) if len(volumes) > 1 else 0,
                min=min(volumes),
                max=max(volumes),
                q1=round(pd.Series(volumes).quantile(0.25)),
                q3=round(pd.Series(volumes).quantile(0.75))
            )
        )
    
    return response