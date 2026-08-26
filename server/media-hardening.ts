interface Queryable {
  query<T = unknown>(sql: string): Promise<{ rows: T[] }>;
}

interface PrivateMediaRewriter {
  rewritePrivate(id: string): Promise<void>;
}

export async function hardenExistingMedia(pool: Queryable, mediaStore: PrivateMediaRewriter): Promise<number> {
  const media = await pool.query<{ id: string }>('SELECT id FROM media_objects ORDER BY created_at, id');
  let updated = 0;
  for (const { id } of media.rows) {
    await mediaStore.rewritePrivate(id);
    updated += 1;
  }
  return updated;
}
