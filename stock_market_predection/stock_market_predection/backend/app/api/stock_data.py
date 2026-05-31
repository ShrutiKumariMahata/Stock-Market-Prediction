from fastapi import APIRouter, HTTPException, Query
from app.data.fetcher import fetch_stock_data, fetch_multiple_stocks, fetch_current_price
from app.schemas.stock import StockDataResponse, OHLCVRecord, StockInfoResponse, CompanyInfo
from app.model.indicators import get_all_indicators
import math
import logging
from typing import Optional, List
from datetime import datetime, timedelta

router = APIRouter()
logger = logging.getLogger(__name__)

# Valid periods with descriptions
VALID_PERIODS = {
    "1d": "1 Day",
    "5d": "5 Days",
    "1mo": "1 Month",
    "3mo": "3 Months",
    "6mo": "6 Months",
    "1y": "1 Year",
    "2y": "2 Years",
    "5y": "5 Years",
    "max": "Maximum Available"
}

@router.get("/stock/{ticker}", response_model=StockDataResponse)
def get_stock_data(
    ticker: str,
    period: str = Query(
        default="1mo",
        description="Time period for historical data",
        regex="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|max)$"
    ),
    include_indicators: bool = Query(
        default=False,
        description="Include technical indicators in response"
    )
):
    """
    Fetch historical stock data with optional technical indicators
    
    Args:
        ticker: Stock symbol (e.g., AAPL, RELIANCE.NS)
        period: Time period for data retrieval
        include_indicators: Whether to calculate and include technical indicators
    
    Returns:
        StockDataResponse with OHLCV records and metadata
    """
    try:
        ticker = ticker.upper().strip()
        
        # Validate ticker format
        if not ticker or len(ticker) > 10:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid ticker symbol: {ticker}"
            )
        
        # Fetch data
        df = fetch_stock_data(ticker, period)
        
        if df is None or df.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for ticker {ticker} in period {period}"
            )
        
        # Reset index to get Date as column
        df = df.reset_index()
        
        # Convert to OHLCV records with better error handling
        records = []
        skipped_records = 0
        
        for _, row in df.iterrows():
            try:
                # Extract and validate values
                record = create_ohlcv_record(row)
                if record:
                    records.append(record)
                else:
                    skipped_records += 1
            except Exception as e:
                logger.warning(f"Skipping row due to error: {e}")
                skipped_records += 1
                continue
        
        # Calculate additional metadata
        metadata = {
            "ticker": ticker,
            "period": period,
            "interval": "1d",
            "trading_days": len(records),
            "total_records": len(records),
            "data_start": records[0].date if records else None,
            "data_end": records[-1].date if records else None,
            "missing_values": skipped_records,
            "data_source": "Yahoo Finance"
        }
        
        # Add technical indicators if requested
        indicators = None
        if include_indicators and len(records) > 20:
            try:
                df_original = df.set_index('Date') if 'Date' in df.columns else df
                indicators = get_all_indicators(df_original)
            except Exception as e:
                logger.error(f"Failed to calculate indicators: {e}")
        
        # Add price statistics
        if records:
            prices = [r.close for r in records]
            metadata.update({
                "price_summary": {
                "mean": round(sum(prices) / len(prices), 2),
                "median": round(sorted(prices)[len(prices)//2], 2),
                "std": 0,
                "min": min(prices),
                "max": max(prices),
                "q1": 0,
                "q3": 0
                }
            })
        
        return StockDataResponse(
            ticker=ticker,
            period=period,
            data=records,
            total_records=len(records),
            metadata=metadata,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching stock data for {ticker}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error while fetching data for {ticker}"
        )


def create_ohlcv_record(row) -> Optional[OHLCVRecord]:
    """
    Safely create an OHLCVRecord from a DataFrame row
    
    Args:
        row: DataFrame row containing stock data
    
    Returns:
        OHLCVRecord or None if invalid data
    """
    try:
        # Extract date (handle different date column names)
        date_col = None
        for col in ['Date', 'Datetime', 'date', 'datetime']:
            if col in row.index:
                date_col = col
                break
        
        if date_col is None:
            # Try using index name
            date_val = str(row.name)[:10]
        else:
            date_val = str(row[date_col])[:10]
        
        # Extract OHLCV values with validation
        def safe_float(val, default=None):
            """Safely convert value to float"""
            if hasattr(val, "item"):
                val = val.item()
            try:
                val = float(val)
                if math.isnan(val) or math.isinf(val):
                    return default
                return round(val, 2)
            except (ValueError, TypeError):
                return default
        
        open_price = safe_float(row.get("Open"))
        high_price = safe_float(row.get("High"))
        low_price = safe_float(row.get("Low"))
        close_price = safe_float(row.get("Close"))
        volume = int(row.get("Volume", 0)) if not math.isnan(float(row.get("Volume", 0))) else 0
        
        # Validate prices are logical
        if any(v is None for v in [open_price, high_price, low_price, close_price]):
            return None
        
        if high_price < low_price or close_price < low_price or close_price > high_price:
            logger.warning(f"Invalid price relationship in record: {date_val}")
            return None
        
        return OHLCVRecord(
            date=date_val,
            open=open_price,
            high=high_price,
            low=low_price,
            close=close_price,
            volume=volume
        )
        
    except Exception as e:
        logger.error(f"Error creating OHLCV record: {e}")
        return None


@router.get("/stock/{ticker}/info", response_model=StockInfoResponse)
def get_stock_info(ticker: str):
    """
    Get detailed information about a stock
    """
    try:
        ticker = ticker.upper().strip()
        
        # Fetch company info (you need to implement this in fetcher.py)
        from app.data.fetcher import fetch_stock_info
        info = fetch_stock_info(ticker)
        
        # Get current price
        current_price = fetch_current_price(ticker)
        
        # Get recent performance
        df_1m = fetch_stock_data(ticker, period="1mo")
        df_1y = fetch_stock_data(ticker, period="1y")
        
        monthly_change = None
        yearly_change = None
        
        if df_1m is not None and not df_1m.empty:
            monthly_change = round(
                ((df_1m['Close'].iloc[-1] - df_1m['Close'].iloc[0]) / df_1m['Close'].iloc[0]) * 100, 2
            )
        
        if df_1y is not None and not df_1y.empty:
            yearly_change = round(
                ((df_1y['Close'].iloc[-1] - df_1y['Close'].iloc[0]) / df_1y['Close'].iloc[0]) * 100, 2
            )
        
        return StockInfoResponse(
            ticker=ticker,
            company_info=CompanyInfo(
                name=info.get('longName', 'N/A'),
                symbol=ticker,
                sector=info.get('sector'),
                industry=info.get('industry'),
                current_price=current_price,
                currency=info.get('currency', 'USD'),
                exchange=info.get('exchange'),
                market_cap=info.get('marketCap'),
                pe_ratio=info.get('trailingPE'),
                dividend_yield=info.get('dividendYield'),
                fifty_two_week_high=info.get('fiftyTwoWeekHigh'),
                fifty_two_week_low=info.get('fiftyTwoWeekLow'),
            ),
            current_price=current_price,
            recent_performance={
                "monthly_change": monthly_change,
                "yearly_change": yearly_change
            }
        )
        
    except Exception as e:
        logger.error(f"Error fetching stock info for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stock/batch", response_model=List[StockDataResponse])
def get_multiple_stocks(
    tickers: List[str],
    period: str = "1mo"
):
    """
    Fetch data for multiple stocks simultaneously
    """
    try:
        results = []
        failed = []
        
        for ticker in tickers:
            try:
                response = get_stock_data(ticker, period)
                results.append(response)
            except Exception as e:
                failed.append({"ticker": ticker, "error": str(e)})
        
        if not results and failed:
            raise HTTPException(
                status_code=404,
                detail=f"Failed to fetch data for all tickers: {failed}"
            )
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))