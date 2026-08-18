export function isOperationsRoute(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/$/, '');
  return normalizedPath.endsWith('/ops') || normalizedPath.endsWith('/ops.html') || normalizedPath.endsWith('/ops/index.html');
}
