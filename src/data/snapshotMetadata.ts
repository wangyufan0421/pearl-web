export function snapshotMetadata(response: Response) {
  const value = response.headers?.get("x-data-fetched-at");
  const date = value ? new Date(value) : new Date();
  return {
    fetchedAt: Number.isNaN(date.getTime()) ? new Date() : date,
    stale: response.headers?.get("x-data-stale") === "true",
    ...(response.headers?.get("x-data-stale") === "true" ? { notice: "当前显示上次成功保存的数据，后台仍在尝试更新。" } : {}),
  };
}
