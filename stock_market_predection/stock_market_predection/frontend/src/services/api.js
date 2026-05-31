import axios from "axios";

// Base configuration
const BASE = "/api";
const TIMEOUT = 30000; // 30 seconds

// Create axios instance with defaults
const api = axios.create({
  baseURL: BASE,
  timeout: TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ==================== Request Interceptor ====================
api.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    if (config.method === "get") {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }

    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(
        `🚀 ${config.method?.toUpperCase()} ${config.url}`,
        config.params || config.data,
      );
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// ==================== Response Interceptor ====================
api.interceptors.response.use(
  (response) => {
    // Log response time in development
    if (import.meta.env.DEV) {
      const responseTime = response.headers["x-response-time"];
      console.log(
        `✅ ${response.config.url} - ${response.status} ${responseTime ? `(${responseTime})` : ""}`,
      );
    }
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 429:
          console.warn(
            "Rate limited. Consider adding delays between requests.",
          );
          break;
        case 500:
          console.error(
            "Server error:",
            data?.detail || "Internal server error",
          );
          break;
        case 503:
          console.error("Service unavailable. The model may be loading.");
          break;
      }
    } else if (error.request) {
      console.error("Network error: No response received");
    }

    return Promise.reject(error);
  },
);

// ==================== Health Check ====================
export const getHealth = async () => {
  try {
    const response = await api.get("/health");
    return response.data;
  } catch (error) {
    console.error("Health check failed:", error);
    throw error;
  }
};

// ==================== Stock Data ====================
export const getStockData = async (ticker, period = "1mo", options = {}) => {
  const { signal, includeInfo = false } = options;

  try {
    const response = await api.get(`/stock/${ticker}`, {
      params: {
        period,
        include_indicators: true,
      },
      signal,
    });
    return response;
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log("Request cancelled:", ticker);
      throw error;
    }
    throw error;
  }
};

export const getStockInfo = async (ticker) => {
  try {
    const response = await api.get(`/stock/${ticker}/info`);
    return response;
  } catch (error) {
    throw error;
  }
};

export const getMultipleStocks = async (tickers, period = "1mo") => {
  try {
    const response = await api.post("/stock/batch", {
      tickers,
      period,
    });
    return response;
  } catch (error) {
    throw error;
  }
};

export const getCacheStats = async () => {
  try {
    const response = await api.get("/cache/stats");
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const clearCache = async (ticker = null) => {
  try {
    const response = await api.delete("/cache/clear", {
      params: ticker ? { ticker } : {},
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ==================== Prediction ====================
export const getPrediction = async (ticker, horizon = "1d", options = {}) => {
  const { signal, includeDetails = true } = options;

  try {
    const response = await api.post(
      "/predict",
      {
        ticker: ticker.toUpperCase(),
        horizon,
        include_details: includeDetails,
      },
      {
        signal,
      },
    );
    return response;
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log("Prediction cancelled:", ticker);
      throw error;
    }
    throw error;
  }
};

export const getBatchPrediction = async (tickers, horizon = "1d") => {
  try {
    const response = await api.post("/predict/batch", {
      tickers,
      horizon,
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// ==================== Training ====================
export const startTrainingStream = (
  config = {},
  onMessage,
  onError,
  onDone,
) => {
  const {
    ticker = "AAPL",
    epochs = 50,
    batchSize = 32,
    learningRate = 0.001,
    sequenceLength = 60,
    modelType = "lstm_attention",
  } = config;

  // Build query parameters
  const params = new URLSearchParams({
    ticker,
    epochs,
    batch_size: batchSize,
    learning_rate: learningRate,
    sequence_length: sequenceLength,
    model_type: modelType,
  });

  const url = `${BASE}/train?${params.toString()}`;
  const es = new EventSource(url);

  // Connection opened
  es.onopen = () => {
    console.log("📡 Training stream connected");
  };

  // Message received
  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // Call message handler
      if (onMessage) {
        onMessage(data);
      }

      // Check for completion
      if (data.type === "completed" || data.type === "done") {
        console.log("✅ Training completed");
        es.close();
        if (onDone) onDone(data);
      }

      // Check for errors
      if (data.type === "error") {
        console.error("❌ Training error:", data.message);
        es.close();
        if (onError) onError(data.message);
      }
    } catch (err) {
      console.error("Failed to parse training event:", err);
    }
  };

  // Error handling
  es.onerror = (event) => {
    console.error("🔌 Training stream error:", event);

    // Check if connection is closed
    if (es.readyState === EventSource.CLOSED) {
      console.log("Stream closed");
      if (onDone) onDone(null);
    } else if (es.readyState === EventSource.CONNECTING) {
      console.log("Reconnecting...");
    }

    // Don't close automatically - let it try to reconnect
  };

  // Return the EventSource for manual control
  return es;
};

export const getTrainingStatus = async () => {
  try {
    const response = await api.get("/train/status");
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const stopTraining = async () => {
  try {
    const response = await api.post("/train/stop");
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ==================== Market Data ====================
export const getMarketOverview = async () => {
  try {
    const response = await api.get("/market/overview");
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ==================== Model Info ====================
export const getModelInfo = async () => {
  try {
    const response = await api.get("/model/info");
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ==================== Configuration ====================
export const getApiConfig = async () => {
  try {
    const response = await api.get("/config");
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ==================== Utility Functions ====================
export const fetchWithRetry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;

      // Don't retry on 4xx errors (except 429)
      if (
        error.response?.status >= 400 &&
        error.response?.status < 500 &&
        error.response?.status !== 429
      ) {
        throw error;
      }

      console.log(`Retry ${i + 1}/${retries} after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

// Export the axios instance for direct use
export { api };
export default api;
