import AsyncStorage from '@react-native-async-storage/async-storage';

let currentSession = null;

// Helper to get authorization headers
function getHeaders(token) {
  const t = token || (currentSession && currentSession.token);
  const headers = {
    'Content-Type': 'application/json',
  };
  if (t) {
    headers['Authorization'] = `Bearer ${t}`;
  }
  return headers;
}

// Helper to get base URL
function getBaseUrl(serverUrl) {
  const url = serverUrl || (currentSession && currentSession.serverUrl);
  if (!url) {
    throw new Error('No server URL available. Please log in first.');
  }
  return url;
}

export async function login(url, username, password) {
  let cleanUrl = url.trim();
  if (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }

  const response = await fetch(`${cleanUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    let errorText = '';
    try {
      const errorJson = await response.json();
      errorText = errorJson.error || errorJson.message || '';
    } catch (e) {
      errorText = await response.text();
    }
    throw new Error(errorText || `Login failed with status ${response.status}`);
  }

  const data = await response.json();
  const token = (data.user && data.user.token) || data.token || '';
  
  const session = {
    user: data.user,
    token: token,
    serverUrl: cleanUrl,
  };

  await AsyncStorage.setItem('userSession', JSON.stringify(session));
  await AsyncStorage.setItem('serverUrl', cleanUrl);
  await AsyncStorage.setItem('token', token);
  currentSession = session;
  return session;
}

export async function getCurrentSession() {
  if (currentSession) return currentSession;
  try {
    const sessionStr = await AsyncStorage.getItem('userSession');
    if (sessionStr) {
      currentSession = JSON.parse(sessionStr);
      return currentSession;
    }
  } catch (e) {
    console.error('Failed to read session from AsyncStorage:', e);
  }
  return null;
}

export async function getUsers(serverUrl, token) {
  const baseUrl = getBaseUrl(serverUrl);
  const response = await fetch(`${baseUrl}/api/users`, {
    method: 'GET',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status}`);
  }

  const data = await response.json();
  return data.users || data;
}

export async function getLibraries() {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/libraries`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch libraries: ${response.status}`);
  }

  const data = await response.json();
  return data.libraries || data;
}

export async function getLibraryItems(libraryId, search = '') {
  const baseUrl = getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/libraries/${libraryId}/items?search=${encodeURIComponent(search)}`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch library items: ${response.status}`);
  }

  return await response.json();
}

export async function getItemDetails(itemId) {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/items/${itemId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch item details: ${response.status}`);
  }

  return await response.json();
}

export async function getMediaProgress(itemId) {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/me/progress/${itemId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch media progress: ${response.status}`);
  }

  return await response.json();
}

export async function updateMediaProgress(itemId, progressData) {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/me/progress/${itemId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      currentTime: progressData.currentTime,
      duration: progressData.duration,
      progress: progressData.progress,
      isFinished: progressData.isFinished,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update media progress: ${response.status}`);
  }

  return await response.json();
}

export function getCoverUrl(itemId) {
  if (!currentSession) return '';
  return `${currentSession.serverUrl}/api/items/${itemId}/cover?token=${currentSession.token}`;
}

export function getAudioFileStreamUrl(itemId, fileId) {
  if (!currentSession) return '';
  return `${currentSession.serverUrl}/api/items/${itemId}/file/${fileId}/download?token=${currentSession.token}`;
}

export async function logout() {
  await AsyncStorage.removeItem('userSession');
  await AsyncStorage.removeItem('serverUrl');
  await AsyncStorage.removeItem('token');
  currentSession = null;
}

// Expose internal session setter for component syncing
export function setCurrentSession(session) {
  currentSession = session;
}
