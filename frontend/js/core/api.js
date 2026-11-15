(() => {
  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;
  }

  window.REMSApi = {
    get: (url) => request(url),

    post: (url, body) =>
      request(url, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    patch: (url, body) =>
      request(url, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    delete: (url) =>
      request(url, {
        method: "DELETE",
      }),
  };
})();
