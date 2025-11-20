# Sync Status API

## 概述

Sync Status API 用于查询所有网络的同步状态，帮助监控索引器的运行情况。

## 端点

### GET /api/sync-status

获取所有网络的同步状态。

**请求示例：**

```bash
curl http://localhost:3001/api/sync-status
```

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "name": "base",
      "chainId": 8453,
      "isActive": true,
      "lastIndexedTimestamp": 1700000000,
      "lastIndexedAt": "2024-11-15T12:00:00.000Z",
      "lagSeconds": 120,
      "lagMinutes": 2.0,
      "syncStatus": "synced",
      "syncStatusLabel": "✅ 正常同步"
    },
    {
      "name": "base-sepolia",
      "chainId": 84532,
      "isActive": true,
      "lastIndexedTimestamp": 1699999500,
      "lastIndexedAt": "2024-11-15T11:55:00.000Z",
      "lagSeconds": 420,
      "lagMinutes": 7.0,
      "syncStatus": "delayed",
      "syncStatusLabel": "⚠️ 轻微延迟"
    },
    {
      "name": "x-layer",
      "chainId": 195,
      "isActive": false,
      "lastIndexedTimestamp": 0,
      "lastIndexedAt": null,
      "lagSeconds": 0,
      "lagMinutes": 0,
      "syncStatus": "not_started",
      "syncStatusLabel": "未开始"
    }
  ]
}
```

## 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 网络名称 |
| `chainId` | number | 链 ID |
| `isActive` | boolean | 是否激活 |
| `lastIndexedTimestamp` | number | 最后索引的时间戳（Unix 秒） |
| `lastIndexedAt` | string \| null | 最后索引的时间（ISO 8601 格式） |
| `lagSeconds` | number | 延迟秒数 |
| `lagMinutes` | number | 延迟分钟数（保留 2 位小数） |
| `syncStatus` | string | 同步状态：`not_started`、`synced`、`delayed`、`critical` |
| `syncStatusLabel` | string | 同步状态标签（中文） |

## 同步状态定义

| 状态 | 值 | 条件 | 说明 |
|------|------|------|------|
| 未开始 | `not_started` | `lastIndexedTimestamp == 0` | 索引器尚未开始工作 |
| 正常同步 | `synced` | 延迟 < 5 分钟 | 索引器正常运行，数据实时更新 |
| 轻微延迟 | `delayed` | 5 分钟 ≤ 延迟 < 1 小时 | 索引器运行但有轻微延迟 |
| 严重延迟 | `critical` | 延迟 ≥ 1 小时 | 索引器可能已停止或遇到错误 |

## 使用场景

### 1. 监控面板

在管理面板中显示所有网络的同步状态：

```typescript
async function displaySyncStatus() {
  const response = await fetch('/api/sync-status');
  const { data } = await response.json();
  
  data.forEach(network => {
    console.log(`${network.name}: ${network.syncStatusLabel}`);
  });
}
```

### 2. 告警系统

检测是否有网络同步异常：

```typescript
async function checkForAlerts() {
  const response = await fetch('/api/sync-status');
  const { data } = await response.json();
  
  const critical = data.filter(n => 
    n.isActive && n.syncStatus === 'critical'
  );
  
  if (critical.length > 0) {
    sendAlert(`${critical.length} networks have critical sync delays`);
  }
}
```

### 3. 健康检查

集成到系统健康检查中：

```typescript
async function healthCheck() {
  const response = await fetch('/api/sync-status');
  const { data } = await response.json();
  
  const allSynced = data
    .filter(n => n.isActive)
    .every(n => n.syncStatus === 'synced');
  
  return {
    healthy: allSynced,
    networks: data
  };
}
```

## 测试

运行测试脚本：

```bash
# 确保后端服务已启动
pnpm run dev

# 在另一个终端运行测试
pnpm tsx scripts/test-sync-status.ts
```

测试脚本会输出详细的同步状态信息和统计摘要。

## 数据库查询

如果需要直接查询数据库，可以使用以下 SQL：

```sql
-- 查看所有网络的同步状态
SELECT 
  name,
  chain_id,
  is_active,
  last_indexed_timestamp,
  to_timestamp(last_indexed_timestamp) as last_indexed_at,
  EXTRACT(EPOCH FROM NOW()) - last_indexed_timestamp as lag_seconds,
  ROUND((EXTRACT(EPOCH FROM NOW()) - last_indexed_timestamp) / 60, 2) as lag_minutes,
  CASE 
    WHEN last_indexed_timestamp = 0 THEN '未开始'
    WHEN EXTRACT(EPOCH FROM NOW()) - last_indexed_timestamp < 300 THEN '✅ 正常同步'
    WHEN EXTRACT(EPOCH FROM NOW()) - last_indexed_timestamp < 3600 THEN '⚠️ 轻微延迟'
    ELSE '❌ 严重延迟'
  END as sync_status
FROM networks
ORDER BY is_active DESC, name;
```

## 相关文件

- **类型定义**: `src/types.ts` - `NetworkSyncStatus`
- **数据库模型**: `src/database/models/network.ts` - `getNetworksSyncStatus()`
- **API 路由**: `src/routes/index.ts` - `GET /api/sync-status`
- **测试脚本**: `scripts/test-sync-status.ts`
- **数据库 Schema**: `src/database/schema.sql` - `networks.last_indexed_timestamp`

## 注意事项

1. **时区**: 所有时间戳使用 UTC 时区
2. **精度**: `lastIndexedTimestamp` 使用秒级 Unix 时间戳
3. **缓存**: 数据直接从数据库读取，无缓存
4. **性能**: 查询非常轻量，可以高频调用
5. **权限**: 当前无需认证，考虑生产环境添加认证

