import { useState, useEffect, useCallback, useRef } from "react";
import { getStockData, getStockInfo } from "../services/api";

export default function useStockData(ticker, period = "1mo", options = {}) {
  const {
    autoFetch = true,
    refreshInterval = 0, // 0 = no auto-refresh
    includeInfo = false,
    onError = null,
    onSuccess = null,
    retryCount = 2,
    staleTime = 5 * 60 * 1000, // 5 minutes
  } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isStale, setIsStale] = useState(false);

  // Additional states
  const [stats, setStats] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [retriesLeft, setRetriesLeft] = useState(retryCount);

  // Refs for cleanup
  const abortControllerRef = useRef(null);
  const intervalRef = useRef(null);
  const isMountedRef = useRef(false);
  const lastFetchRef = useRef(null);

  // Calculate statistics from data
  const calculateStats = useCallback((stockData) => {
    if (!stockData || stockData.length === 0) return null;

    const prices = stockData.map((d) => d.close).filter((p) => p != null);
    const volumes = stockData.map((d) => d.volume).filter((v) => v != null);

    if (prices.length === 0) return null;

    const sortedPrices = [...prices].sort((a, b) => a - b);

    return {
      price: {
        current: prices[prices.length - 1],
        open: stockData[stockData.length - 1]?.open,
        high: Math.max(...prices),
        low: Math.min(...prices),
        average: prices.reduce((a, b) => a + b, 0) / prices.length,
        median: sortedPrices[Math.floor(sortedPrices.length / 2)],
        change: prices[prices.length - 1] - prices[0],
        changePercent:
          ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100,
        volatility: calculateVolatility(prices),
      },
      volume: {
        average: volumes.reduce((a, b) => a + b, 0) / volumes.length,
        total: volumes.reduce((a, b) => a + b, 0),
        max: Math.max(...volumes),
        min: Math.min(...volumes),
        latest: volumes[volumes.length - 1],
      },
      records: stockData.length,
      dateRange: {
        start: stockData[0]?.date,
        end: stockData[stockData.length - 1]?.date,
      },
    };
  }, []);

  // Calculate price volatility
  const calculateVolatility = (prices) => {
    if (prices.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  };

  // Fetch data function
  const fetchData = useCallback(
    async (forceRefresh = false) => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Check if data is stale
      if (!forceRefresh && lastFetchRef.current) {
        const age = Date.now() - lastFetchRef.current;
        if (age < staleTime) {
          setIsStale(false);
          return;
        }
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      try {
        // Fetch stock data
        const res = await getStockData(ticker, period, {
          signal: abortControllerRef.current.signal,
        });

        const stockData = res.data?.data || [];

        if (isMountedRef.current) {
          setData(stockData);
          setStats(calculateStats(stockData));
          setLastUpdated(new Date().toISOString());
          setIsStale(false);
          lastFetchRef.current = Date.now();
          setRetriesLeft(retryCount);

          if (onSuccess) {
            onSuccess(stockData);
          }
        }

        // Optionally fetch company info
        if (includeInfo && ticker) {
          try {
            const infoRes = await getStockInfo(ticker);
            if (isMountedRef.current) {
              setCompanyInfo(infoRes.data);
            }
          } catch (infoErr) {
            console.warn("Failed to fetch company info:", infoErr);
          }
        }

        return stockData;
      } catch (err) {
        // Handle aborted requests
        if (err.name === "AbortError" || err.name === "CanceledError") {
          return null;
        }

        const errorMessage =
          err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          "Failed to fetch stock data";

        if (isMountedRef.current) {
          setError(errorMessage);
          setData([]);
          setStats(null);

          if (onError) {
            onError(errorMessage);
          }
        }

        // Auto-retry logic
        if (retriesLeft > 0 && err.response?.status !== 404) {
          setRetriesLeft((prev) => prev - 1);
          setTimeout(() => fetchData(forceRefresh), 2000);
        }

        return null;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
        abortControllerRef.current = null;
      }
    },
    [
      ticker,
      period,
      includeInfo,
      calculateStats,
      onSuccess,
      onError,
      retriesLeft,
      retryCount,
      staleTime,
    ],
  );

  // Main effect
  useEffect(() => {
    isMountedRef.current = true;

    if (ticker && autoFetch) {
      fetchData();
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [ticker, period]); // Intentionally exclude fetchData to avoid loops

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0 && ticker) {
      intervalRef.current = setInterval(() => {
        fetchData(true);
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshInterval, ticker, fetchData]);

  // Check staleness periodically
  useEffect(() => {
    if (!lastFetchRef.current) return;

    const stalenessCheck = setInterval(() => {
      const age = Date.now() - lastFetchRef.current;
      setIsStale(age > staleTime);
    }, 10000); // Check every 10 seconds

    return () => clearInterval(stalenessCheck);
  }, [staleTime]);

  // Refresh function
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Cancel request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Get specific data points
  const getLatestPrice = useCallback(() => {
    return data.length > 0 ? data[data.length - 1].close : null;
  }, [data]);

  const getPriceAtDate = useCallback(
    (date) => {
      return data.find((d) => d.date === date)?.close || null;
    },
    [data],
  );

  // Filter data by date range
  const getDataInRange = useCallback(
    (startDate, endDate) => {
      return data.filter((d) => {
        const date = new Date(d.date);
        return date >= new Date(startDate) && date <= new Date(endDate);
      });
    },
    [data],
  );

  return {
    // Core states
    data,
    loading,
    error,

    // Enhanced states
    stats,
    companyInfo,
    lastUpdated,
    isStale,
    retriesLeft,

    // Actions
    refresh,
    cancelRequest,

    // Helpers
    getLatestPrice,
    getPriceAtDate,
    getDataInRange,

    // Status
    isEmpty: data.length === 0 && !loading,
    hasError: error !== null,
    isReady: !loading && data.length > 0,
    hasCompanyInfo: companyInfo !== null,
  };
}

// Hook for real-time stock data
export function useLiveStockData(ticker, interval = 10000) {
  return useStockData(ticker, "1d", {
    refreshInterval: interval,
    staleTime: 5000,
    autoFetch: true,
  });
}

// Hook for multiple stocks comparison
export function useMultipleStocks(tickers, period = "1mo") {
  const [stocksData, setStocksData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const fetchAll = useCallback(async () => {
    if (!tickers || tickers.length === 0) return;

    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: tickers.length });

    const results = {};
    const errors = [];

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      try {
        const res = await getStockData(ticker, period);
        results[ticker] = res.data.data || [];
        setProgress({ current: i + 1, total: tickers.length });
      } catch (err) {
        errors.push({ ticker, error: err.message });
        results[ticker] = [];
      }
    }

    setStocksData(results);
    setLoading(false);

    if (errors.length > 0) {
      setError(`${errors.length} stock(s) failed to load`);
    }
  }, [tickers, period]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { stocksData, loading, error, progress, refresh: fetchAll };
}
