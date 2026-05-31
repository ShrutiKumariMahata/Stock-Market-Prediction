from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class HorizonEnum(str, Enum):
    ONE_DAY = "1d"
    FIVE_DAYS = "5d"
    ONE_MONTH = "1m"
    THREE_MONTHS = "3m"
    SIX_MONTHS = "6m"


class SignalEnum(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    STRONG_BUY = "STRONG_BUY"
    STRONG_SELL = "STRONG_SELL"


class PredictionRequest(BaseModel):
    ticker: str = Field(
        ..., 
        min_length=1, 
        max_length=10,
        description="Stock ticker symbol (e.g., AAPL, RELIANCE.NS)",
        examples=["AAPL"]
    )
    horizon: str = Field(
        default="1d",
        description="Prediction time horizon",
        pattern="^(1d|5d|1m|3m|6m)$",
        examples=["5d"]
    )
    include_details: bool = Field(
        default=False,
        description="Include detailed technical analysis"
    )
    
    @validator('ticker')
    def validate_ticker(cls, v):
        v = v.upper().strip()
        if not v:
            raise ValueError('Ticker cannot be empty')
        if len(v) > 10:
            raise ValueError('Ticker too long')
        return v
    
    class Config:
        json_schema_extra = {  # ← FIXED
            "example": {
                "ticker": "AAPL",
                "horizon": "5d",
                "include_details": True
            }
        }


class BatchPredictionRequest(BaseModel):
    tickers: List[str] = Field(
        ..., 
        min_length=1,   # ← FIXED (was min_items)
        max_length=10,  # ← FIXED (was max_items)
        description="List of stock tickers"
    )
    horizon: str = Field(default="1d")
    
    @validator('tickers')
    def validate_tickers(cls, v):
        return [ticker.upper().strip() for ticker in v]


class MACDDetails(BaseModel):
    macd_line: float
    signal_line: float
    histogram: float
    signal: str
    trend_strength: float


class BollingerDetails(BaseModel):
    upper: float
    middle: float
    lower: float
    current_price: float
    position: str
    strength: str
    bandwidth: float
    percent_b: float


class VolumeDetails(BaseModel):
    current_volume: float
    short_ma: float
    long_ma: float
    ratio: float
    trend: str
    analysis: str


class MovingAverages(BaseModel):
    MA_7: Optional[float] = None
    MA_21: Optional[float] = None
    MA_50: Optional[float] = None
    MA_200: Optional[float] = None
    trend: Optional[str] = None


class SupportResistance(BaseModel):
    support_1: float
    support_2: float
    resistance_1: float
    resistance_2: float
    current_price: float
    distance_to_support: float
    distance_to_resistance: float


class TechnicalIndicators(BaseModel):
    rsi: float = Field(..., ge=0, le=100)
    macd: str
    bollinger: str
    volume_trend: str
    beta: float = Field(..., ge=0)
    sentiment_score: Optional[float] = Field(default=None, ge=-100, le=100)
    market_sentiment: Optional[str] = None
    macd_details: Optional[MACDDetails] = None
    bollinger_details: Optional[BollingerDetails] = None
    volume_details: Optional[VolumeDetails] = None
    moving_averages: Optional[MovingAverages] = None
    support_resistance: Optional[SupportResistance] = None
    
    class Config:
        json_schema_extra = {  # ← FIXED
            "example": {
                "rsi": 58.34,
                "macd": "Bullish crossover",
                "bollinger": "Upper half",
                "volume_trend": "Above average volume",
                "beta": 1.25,
                "sentiment_score": 65.5,
                "market_sentiment": "Bullish"
            }
        }


class PredictionMetadata(BaseModel):
    model_version: str = "2.1.0"
    model_type: str = "LSTM-Attention"
    prediction_timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    data_freshness: str = Field(default_factory=lambda: datetime.now().isoformat())
    confidence_interval: Optional[Dict[str, float]] = None


class PredictionResponse(BaseModel):
    ticker: str
    horizon: str
    current_price: float = Field(..., gt=0)
    predicted_price: float = Field(..., gt=0)
    change_pct: float
    change_absolute: Optional[float] = None
    confidence: float = Field(..., ge=0, le=100)
    signal: str  # Changed from SignalEnum to str for flexibility
    prediction_range: Optional[Dict[str, float]] = None
    indicators: TechnicalIndicators
    analysis: str
    summary: Optional[str] = None
    metadata: PredictionMetadata = Field(default_factory=PredictionMetadata)
    
    @validator('change_absolute', always=True)
    def calculate_absolute_change(cls, v, values):
        if 'current_price' in values and 'predicted_price' in values:
            return round(values['predicted_price'] - values['current_price'], 2)
        return v
    
    class Config:
        json_schema_extra = {  # ← FIXED
            "example": {
                "ticker": "AAPL",
                "horizon": "5d",
                "current_price": 175.50,
                "predicted_price": 178.25,
                "change_pct": 1.57,
                "confidence": 82.5,
                "signal": "BUY",
                "indicators": {
                    "rsi": 58.34,
                    "macd": "Bullish",
                    "bollinger": "Upper half",
                    "volume_trend": "Increasing",
                    "beta": 1.25,
                    "sentiment_score": 65.5
                },
                "analysis": "Bullish trend expected..."
            }
        }

class ForecastPoint(BaseModel):
    date: str
    close: Optional[float] = None
    forecast: Optional[float] = None
    upper_bound: Optional[float] = None
    lower_bound: Optional[float] = None

class PredictionResponse(BaseModel):
    ticker: str
    horizon: str
    current_price: float = Field(..., gt=0)
    predicted_price: float = Field(..., gt=0)
    change_pct: float
    change_absolute: Optional[float] = None
    confidence: float = Field(..., ge=0, le=100)
    signal: str
    prediction_range: Optional[Dict[str, float]] = None
    indicators: TechnicalIndicators
    analysis: str
    summary: Optional[str] = None
    forecast_series: Optional[List[ForecastPoint]] = None  # ← add this
    metadata: PredictionMetadata = Field(default_factory=PredictionMetadata)