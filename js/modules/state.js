// Global state management
let isAdmin = false;
let selectedStudentId = null;
let selectedStudent = null;
let customSkillsCache = null;
let allStudentsCache = [];
let allSkillsCache = [];
let currentStudentForNotes = null;

// Global cache for skill templates with timestamp
let skillTemplatesCache = {
    data: [],
    timestamp: null,
    expiryTime: 5 * 60 * 1000 // 5 minutes cache
};

// Global cache for statistics to avoid repeated calls
let statisticsCache = {
    data: null,
    timestamp: null,
    expiryTime: 30 * 1000 // 30 seconds cache
};

// Global cache for activities
let activitiesCache = {
    data: null,
    timestamp: null,
    expiryTime: 30 * 1000 // 30 seconds cache
};

// Pending API requests (for deduplication)
let pendingRequests = new Map();

// Helper function to check if cache is valid
function isCacheValid(cache) {
    if (!cache.timestamp || !cache.data) return false;
    return (Date.now() - cache.timestamp) < cache.expiryTime;
}

// Helper function to deduplicate API calls
async function deduplicatedFetch(key, fetchFn) {
    if (pendingRequests.has(key)) {
        return await pendingRequests.get(key);
    }
    
    const promise = fetchFn();
    pendingRequests.set(key, promise);
    
    try {
        const result = await promise;
        return result;
    } finally {
        pendingRequests.delete(key);
    }
}

// Invalidate all caches on data mutation
function invalidateAllCaches() {
    statisticsCache.timestamp = null;
    activitiesCache.timestamp = null;
    skillTemplatesCache.timestamp = null;
}
