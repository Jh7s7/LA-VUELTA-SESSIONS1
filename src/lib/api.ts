const TOKEN_STORAGE_KEY = 'LV_SESSION_TOKEN';

export function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}

export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || `Error ${response.status}: No se pudo completar la solicitud.`);
  }

  return data as T;
}

export async function downloadAuthenticatedCsv(queryParams: Record<string, string>): Promise<void> {
  const qs = new URLSearchParams(
    Object.entries(queryParams).filter(([, v]) => Boolean(v))
  ).toString();
  const url = `/api/admin/stats/export.csv${qs ? `?${qs}` : ''}`;
  const token = getStoredToken();

  const resp = await fetch(url, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'No se pudo exportar el archivo CSV.');
  }

  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `estadisticas_eventos_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadAuthenticatedBackup(): Promise<void> {
  const token = getStoredToken();
  const response = await fetch('/api/admin/backup/export', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('No se pudo descargar el archivo de respaldo del sistema.');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `lavuelta_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function fileToValidatedDataUrl(
  file: File,
  options?: { allowPdf?: boolean; maxBytes?: number }
): Promise<string> {
  const maxBytes = options?.maxBytes ?? 3 * 1024 * 1024;
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (options?.allowPdf) {
    allowedMimes.push('application/pdf');
  }

  return new Promise((resolve, reject) => {
    if (!allowedMimes.includes(file.type)) {
      reject(
        new Error(
          options?.allowPdf
            ? 'Formato no permitido. Usa JPG, PNG, WEBP o PDF.'
            : 'Formato de imagen no permitido. Usa JPG, PNG o WEBP.'
        )
      );
      return;
    }
    if (file.size > maxBytes) {
      reject(new Error(`El archivo supera el tamaño máximo de ${Math.round(maxBytes / (1024 * 1024))} MB.`));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}
