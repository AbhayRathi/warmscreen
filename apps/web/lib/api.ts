const getBaseUrl = () => {
  // All API routes are now in Next.js, use relative URLs
  return '';
};

const resolveUrl = (url: string) => {
  if (url.startsWith('http')) {
    return url;
  }
  const base = getBaseUrl();
  return base ? `${base}${url}` : url;
};

export async function fetcher(url: string) {
  const fullUrl = resolveUrl(url);
  try {
    const res = await fetch(fullUrl, {
      cache: 'no-store',
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `API error: ${res.status}`);
    }
    return res.json();
  } catch (error: any) {
    if (error.message === 'fetch failed' || error.cause?.code === 'ECONNREFUSED') {
      throw new Error('API server is not running. Please start with: npm run dev');
    }
    throw error;
  }
}

export async function apiPost(url: string, data: any) {
  const fullUrl = resolveUrl(url);
  try {
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      cache: 'no-store',
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
      const error: any = new Error(errorData.error || 'API request failed');
      error.details = errorData.details;
      throw error;
    }
    
    return res.json();
  } catch (error: any) {
    if (error.message === 'fetch failed' || error.cause?.code === 'ECONNREFUSED') {
      throw new Error('API server is not running. Please start with: npm run dev');
    }
    throw error;
  }
}

export async function apiPatch(url: string, data: any) {
  const fullUrl = resolveUrl(url);
  try {
    const res = await fetch(fullUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      cache: 'no-store',
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
      const error: any = new Error(errorData.error || 'API request failed');
      error.details = errorData.details;
      throw error;
    }
    
    return res.json();
  } catch (error: any) {
    if (error.message === 'fetch failed' || error.cause?.code === 'ECONNREFUSED') {
      throw new Error('API server is not running. Please start with: npm run dev');
    }
    throw error;
  }
}

export async function apiDelete(url: string) {
  const fullUrl = resolveUrl(url);
  try {
    const res = await fetch(fullUrl, {
      method: 'DELETE',
      cache: 'no-store',
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || 'API request failed');
    }
    
    return res.json();
  } catch (error: any) {
    if (error.message === 'fetch failed' || error.cause?.code === 'ECONNREFUSED') {
      throw new Error('API server is not running. Please start with: npm run dev');
    }
    throw error;
  }
}
