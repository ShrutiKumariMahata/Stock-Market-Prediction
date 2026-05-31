import { useState, useCallback, useRef } from "react";
import { getPrediction } from "../services/api";

export default function usePrediction(options = {}) {
  const {
    autoClearError = true,
    errorTimeout = 5000,
    retryCount = 2,
    cacheResults = true,
  } = options;

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [retriesLeft, setRetriesLeft] = useState(retryCount);

  const abortControllerRef = useRef(null);
  const errorTimerRef = useRef(null);
  const cacheRef = useRef(new Map());

  // Clear error after timeout
  const clearErrorWithTimeout = useCallback(
    (errorMsg) => {
      setError(errorMsg);

      if (autoClearError) {
        if (errorTimerRef.current) {
          clearTimeout(errorTimerRef.current);
        }
        errorTimerRef.current = setTimeout(() => {
          setError(null);
        }, errorTimeout);
      }
    },
    [autoClearError, errorTimeout],
  );

  // Generate cache key
  const getCacheKey = (ticker, horizon) => {
    return `${ticker.toUpperCase()}_${horizon}`;
  };

  // Check cache
  const getCachedResult = (ticker, horizon) => {
    if (!cacheResults) return null;

    const key = getCacheKey(ticker, horizon);
    const cached = cacheRef.current.get(key);

    if (cached) {
      const now = Date.now();
      const cacheAge = now - cached.timestamp;

      // Cache expires after 5 minutes
      if (cacheAge < 5 * 60 * 1000) {
        return cached.data;
      } else {
        cacheRef.current.delete(key);
      }
    }

    return null;
  };

  // Set cache
  const setCachedResult = (ticker, horizon, data) => {
    if (!cacheResults) return;

    const key = getCacheKey(ticker, horizon);
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
  };

  // Validate inputs
  const validateInputs = (ticker, horizon) => {
    const errors = [];

    if (!ticker || typeof ticker !== "string") {
      errors.push("Ticker symbol is required");
    } else if (ticker.length > 10) {
      errors.push("Invalid ticker symbol");
    }

    const validHorizons = ["1d", "5d", "1m", "3m", "6m"];
    if (!validHorizons.includes(horizon)) {
      errors.push(
        `Invalid horizon. Must be one of: ${validHorizons.join(", ")}`,
      );
    }

    return errors;
  };

  // Main predict function
  const predict = useCallback(
    async (ticker, horizon, forceRefresh = false) => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Validate inputs
      const validationErrors = validateInputs(ticker, horizon);
      if (validationErrors.length > 0) {
        clearErrorWithTimeout(validationErrors.join(". "));
        return null;
      }

      // Check cache
      if (!forceRefresh) {
        const cached = getCachedResult(ticker, horizon);
        if (cached) {
          setResult(cached);
          return cached;
        }
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const res = await getPrediction(ticker.toUpperCase(), horizon, {
          signal: abortControllerRef.current.signal,
        });

        const predictionData = {
          ...res.data,
          _metadata: {
            requestedAt: new Date().toISOString(),
            ticker: ticker.toUpperCase(),
            horizon,
            responseTime: res.headers?.["x-response-time"] || null,
          },
        };

        setResult(predictionData);
        setCachedResult(ticker, horizon, predictionData);

        // Add to history (keep last 10)
        setHistory((prev) => {
          const updated = [
            {
              ticker: ticker.toUpperCase(),
              horizon,
              timestamp: new Date().toISOString(),
              prediction: predictionData,
            },
            ...prev,
          ].slice(0, 10);
          return updated;
        });

        setRetriesLeft(retryCount);
        return predictionData;
      } catch (err) {
        // Handle aborted requests
        if (err.name === "AbortError" || err.name === "CanceledError") {
          console.log("Request cancelled");
          return null;
        }

        const errorMessage =
          err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          "Failed to get prediction";

        // Handle rate limiting
        if (err.response?.status === 429) {
          const retryAfter = err.response.headers["retry-after"] || 5;
          clearErrorWithTimeout(
            `Rate limited. Please wait ${retryAfter} seconds.`,
          );
        } else if (err.response?.status === 404) {
          clearErrorWithTimeout(
            `Stock "${ticker}" not found. Please check the symbol.`,
          );
        } else if (err.response?.status === 422) {
          const details = err.response.data?.detail;
          const msg = Array.isArray(details)
            ? details.map((d) => d.message).join(". ")
            : "Invalid request parameters";
          clearErrorWithTimeout(msg);
        } else if (!err.response) {
          clearErrorWithTimeout("Network error. Please check your connection.");
        } else {
          clearErrorWithTimeout(errorMessage);
        }

        setResult(null);
        return null;
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [cacheResults, clearErrorWithTimeout, retryCount],
  );

  // Retry last prediction
  const retry = useCallback(() => {
    if (history.length > 0) {
      const last = history[0];
      return predict(last.ticker, last.horizon, true);
    }
  }, [history, predict]);

  // Predict multiple stocks
  const predictBatch = useCallback(
    async (stocks, horizon) => {
      setLoading(true);
      setError(null);

      const results = [];
      const errors = [];

      for (const ticker of stocks) {
        try {
          const result = await predict(ticker, horizon);
          if (result) {
            results.push({ ticker, result });
          }
        } catch (err) {
          errors.push({ ticker, error: err.message });
        }
      }

      setLoading(false);

      return { results, errors };
    },
    [predict],
  );

  // Clear result
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setResult(null);
    setError(null);
    setHistory([]);
    cacheRef.current.clear();
  }, []);

  // Cancel ongoing request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  }, []);

  return {
    // State
    result,
    loading,
    error,
    history,
    retriesLeft,

    // Actions
    predict,
    retry,
    predictBatch,
    clearResult,
    clearAll,
    cancelRequest,

    // Helpers
    hasResult: result !== null,
    hasError: error !== null,
    isReady: !loading && !error,

    // Cache management
    clearCache: () => cacheRef.current.clear(),
    cacheSize: cacheRef.current.size,
  };
}

// Specialized prediction hooks
export function useBatchPrediction() {
  const prediction = usePrediction({ cacheResults: false });

  const predictStocks = async (tickers, horizon, onProgress) => {
    const results = [];
    const total = tickers.length;

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      try {
        const result = await prediction.predict(ticker, horizon);
        results.push({ ticker, result, success: true });
      } catch (err) {
        results.push({ ticker, error: err.message, success: false });
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          ticker,
          percentage: Math.round(((i + 1) / total) * 100),
        });
      }
    }

    return results;
  };

  return { ...prediction, predictStocks };
}

export function usePredictionWithAutoRefresh(interval = 60000) {
  const prediction = usePrediction();
  const intervalRef = useRef(null);

  const startAutoRefresh = useCallback(
    (ticker, horizon) => {
      // Initial prediction
      prediction.predict(ticker, horizon);

      // Set up interval
      intervalRef.current = setInterval(() => {
        prediction.predict(ticker, horizon, true); // Force refresh
      }, interval);
    },
    [prediction, interval],
  );

  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopAutoRefresh();
  }, [stopAutoRefresh]);

  return { ...prediction, startAutoRefresh, stopAutoRefresh };
}
