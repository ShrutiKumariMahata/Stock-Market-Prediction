from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os
import time
import logging
from datetime import datetime
from typing import Dict

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Create necessary directories
os.makedirs('logs', exist_ok=True)
os.makedirs('checkpoints', exist_ok=True)
os.makedirs('dataset', exist_ok=True)


# ==================== Application Lifespan ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    Handles startup and shutdown events
    """
    # Startup
    logger.info("=" * 60)
    logger.info("🚀 QuantAI Stock Prediction API Starting...")
    logger.info(f"📅 Startup Time: {datetime.now().isoformat()}")
    logger.info(f"🔧 Environment: {os.getenv('ENVIRONMENT', 'development')}")
    
    # Check for GPU
    try:
        import torch
        if torch.cuda.is_available():
            logger.info(f"🎮 GPU Available: {torch.cuda.get_device_name(0)}")
            logger.info(f"💾 GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        else:
            logger.info("💻 Running on CPU")
    except ImportError:
        logger.info("💻 PyTorch not installed, running on CPU only")
    
    # Check for trained models
    try:
        checkpoints = [f for f in os.listdir('checkpoints') if f.endswith('.pt')]
        if checkpoints:
            logger.info(f"📦 Found {len(checkpoints)} trained model(s)")
            for ckpt in checkpoints:
                logger.info(f"   - {ckpt}")
        else:
            logger.warning("⚠️  No trained models found in checkpoints/")
    except FileNotFoundError:
        logger.warning("⚠️  Checkpoints directory not found")
    
    # Check cache
    try:
        cache_files = [f for f in os.listdir('dataset') if f.endswith('.csv')]
        if cache_files:
            logger.info(f"💾 Found {len(cache_files)} cached datasets")
    except FileNotFoundError:
        logger.info("📂 Dataset cache directory created")
    
    logger.info("✅ API is ready to accept requests")
    logger.info("=" * 60)
    
    yield  # Application runs here
    
    # Shutdown
    logger.info("=" * 60)
    logger.info("🛑 QuantAI API Shutting down...")
    logger.info(f"📅 Shutdown Time: {datetime.now().isoformat()}")
    logger.info("=" * 60)


# ==================== FastAPI App ====================

# App configuration
APP_CONFIG = {
    "title": "QuantAI Stock Prediction API",
    "description": """
    ## Advanced Stock Market Prediction API
    
    ### Features:
    - **LSTM-Transformer Hybrid** model for price prediction
    - **Real-time data** from Yahoo Finance
    - **Technical indicators** (RSI, MACD, Bollinger Bands)
    - **Multi-horizon** predictions (1d, 5d, 1m, 3m, 6m)
    - **Model training** with real-time progress tracking
    - **Batch predictions** for multiple stocks
    
    ### Models Available:
    - LSTM + Multi-Head Attention
    - CNN-LSTM Hybrid
    - Transformer (Experimental)
    
    ### Supported Markets:
    - US Stocks (AAPL, GOOGL, MSFT, etc.)
    - Indian Stocks (RELIANCE.NS, TCS.NS, etc.)
    - Cryptocurrency (BTC-USD, ETH-USD)
    """,
    "version": "2.1.0",
    "docs_url": "/docs",
    "redoc_url": "/redoc",
    "openapi_url": "/openapi.json",
    "contact": {
        "name": "Your Name",
        "email": "your.email@example.com",
        "url": "https://github.com/yourusername/quantai"
    },
    "license_info": {
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    },
    "terms_of_service": "http://example.com/terms/"
}

app = FastAPI(
    **APP_CONFIG,
    lifespan=lifespan
)


# ==================== Middleware ====================

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "ALLOWED_ORIGINS", 
        "http://localhost:5173,http://localhost:3000"
    ).split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
    max_age=3600  # Cache preflight requests for 1 hour
)

# GZip Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Custom middleware for request timing and logging
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add response time and request ID to all responses"""
    # Generate request ID
    request_id = f"{int(time.time() * 1000)}-{os.urandom(4).hex()}"
    
    # Start timer
    start_time = time.time()
    
    # Process request
    try:
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Add custom headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{process_time:.4f}s"
        
        # Log request
        logger.info(
            f"📥 {request.method} {request.url.path} "
            f"- Status: {response.status_code} "
            f"- Time: {process_time:.4f}s "
            f"- ID: {request_id}"
        )
        
        return response
        
    except Exception as e:
        logger.error(f"❌ Request failed: {request.method} {request.url.path} - {str(e)}")
        raise


# ==================== Exception Handlers ====================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed messages"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    logger.warning(f"⚠️  Validation error: {errors}")
    
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "detail": errors,
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Custom 404 handler"""
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": f"Endpoint {request.url.path} not found",
            "timestamp": datetime.now().isoformat(),
            "available_endpoints": [
                "/api/health",
                "/api/predict",
                "/api/stock/{ticker}",
                "/api/train",
                "/docs"
            ]
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Custom 500 handler"""
    logger.error(f"🔥 Internal Server Error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Please try again later.",
            "timestamp": datetime.now().isoformat(),
            "request_id": request.headers.get("X-Request-ID", "N/A")
        }
    )


# ==================== Routers ====================

from app.api import predict, stock_data, train, health

# Health check
app.include_router(
    health.router, 
    prefix="/api", 
    tags=["🔍 Health"]
)

# Stock data endpoints
app.include_router(
    stock_data.router, 
    prefix="/api", 
    tags=["📊 Stock Data"]
)

# Prediction endpoints
app.include_router(
    predict.router, 
    prefix="/api", 
    tags=["🔮 Prediction"]
)

# Training endpoints
app.include_router(
    train.router, 
    prefix="/api", 
    tags=["🧠 Training"]
)


# ==================== Root Endpoints ====================

@app.get("/", tags=["📖 Info"])
async def root():
    """Root endpoint with API information"""
    return {
        "app": "QuantAI",
        "version": "2.1.0",
        "description": "LSTM-Transformer Hybrid Model for Stock Market Prediction",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc",
        "timestamp": datetime.now().isoformat(),
        "endpoints": {
            "health": "/api/health",
            "predict": "/api/predict",
            "stock_data": "/api/stock/{ticker}",
            "train": "/api/train",
            "docs": "/docs"
        }
    }

@app.get("/api", tags=["📖 Info"])
async def api_info():
    """API information endpoint"""
    return {
        "name": "QuantAI API",
        "version": "2.1.0",
        "status": "operational",
        "documentation": "/docs",
        "openapi_spec": "/openapi.json",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/config", tags=["📖 Info"])
async def get_config():
    """Get API configuration (non-sensitive)"""
    return {
        "environment": os.getenv("ENVIRONMENT", "development"),
        "debug": os.getenv("DEBUG", "false").lower() == "true",
        "model_version": "2.1.0",
        "supported_horizons": ["1d", "5d", "1m", "3m", "6m"],
        "max_batch_size": 10,
        "rate_limit": "100 requests/minute",
        "cache_enabled": True,
        "cache_expiry": {
            "1d": "30 minutes",
            "1mo": "6 hours",
            "1y": "2 days"
        }
    }


# ==================== Startup Check ====================

if __name__ == "__main__":
    import uvicorn
    
    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    workers = int(os.getenv("WORKERS", "1"))
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
        workers=workers,
        log_level="info",
        access_log=True
    )