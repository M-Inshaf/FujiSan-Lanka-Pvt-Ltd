# Mobile App Implementation Guide (React Native)

## Overview

This guide outlines how to build a React Native mobile app version of FujiSan-Lanka accounting system.

## Project Setup

```bash
npx react-native init FujiSanLankaMobile
cd FujiSanLankaMobile

# Install dependencies
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install react-native-gesture-handler
npm install axios react-query
npm install react-native-chart-kit
npm install react-native-sqlite-storage
npm install @react-native-async-storage/async-storage
npm install react-native-notified
```

## Project Structure

```
FujiSanLankaMobile/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── CuttingEntry.tsx
│   │   ├── FinishingReceipt.tsx
│   │   ├── AccountLedger.tsx
│   │   ├── Analytics.tsx
│   │   └── AuditLog.tsx
│   ├── services/
│   │   ├── storage.service.ts
│   │   ├── api.service.ts
│   │   ├── analytics.service.ts
│   │   ├── offline.service.ts
│   │   └── collaboration.service.ts
│   ├── hooks/
│   │   ├── useOfflineSync.ts
│   │   ├── useAnalytics.ts
│   │   └── useNotifications.ts
│   ├── screens/
│   │   └── HomeScreen.tsx
│   ├── context/
│   │   └── AppContext.tsx
│   ├── navigation/
│   │   └── Navigation.tsx
│   └── App.tsx
├── app.json
├── package.json
└── tsconfig.json
```

## Key Features for Mobile

### 1. Offline-First Architecture

```typescript
// services/offline.service.ts
import SQLite from 'react-native-sqlite-storage';

class OfflineStorageService {
  private db: SQLite.Database;

  async initialize() {
    this.db = await SQLite.openDatabase({
      name: 'fuji_san.db',
      location: 'default'
    });
    await this.createTables();
  }

  private async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        note TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS cutting (
        id INTEGER PRIMARY KEY,
        agentId INTEGER,
        invoiceNo TEXT,
        date TEXT,
        layers INTEGER,
        sizes INTEGER,
        rate REAL,
        status TEXT,
        synced BOOLEAN DEFAULT 0,
        createdAt TEXT
      )`
      // ... more tables
    ];

    for (const table of tables) {
      await this.db.executeSql(table);
    }
  }

  async saveOffline(table: string, data: any) {
    const columns = Object.keys(data).join(',');
    const placeholders = Object.keys(data).map(() => '?').join(',');
    const values = Object.values(data);

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
    await this.db.executeSql(sql, values);
  }

  async getUnsyncedData() {
    const result = await this.db.executeSql(
      `SELECT * FROM cutting WHERE synced = 0
       UNION SELECT * FROM finishing WHERE synced = 0
       UNION SELECT * FROM ledger WHERE synced = 0`
    );
    return result[0].rows.raw();
  }
}
```

### 2. Data Sync Hook

```typescript
// hooks/useOfflineSync.ts
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'react-query';

export const useOfflineSync = () => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  const syncMutation = useMutation(
    async (data: any) => {
      const response = await api.post('/sync', data);
      return response.data;
    },
    {
      onSuccess: () => {
        setSyncStatus('idle');
        // Mark as synced in local DB
      },
      onError: () => {
        setSyncStatus('error');
      }
    }
  );

  const startSync = async () => {
    setSyncStatus('syncing');
    const unsyncedData = await offlineService.getUnsyncedData();
    setPendingCount(unsyncedData.length);

    for (const item of unsyncedData) {
      await syncMutation.mutateAsync(item);
    }
  };

  // Auto-sync when online
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        startSync();
      }
    });

    return unsubscribe;
  }, []);

  return { syncStatus, pendingCount, startSync };
};
```

### 3. Dashboard Component

```typescript
// components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { analyticsService } from '../services/analytics.service';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    const metrics = await analyticsService.calculateKPIs();
    setMetrics(metrics);

    const trend = await analyticsService.getRevenueTrend();
    setChartData({
      labels: trend.map(t => t.date),
      datasets: [{
        data: trend.map(t => t.bills),
        color: () => '#2563eb'
      }]
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <KPICard
          label="Total Revenue"
          value={`LKR ${metrics?.totalRevenue.toFixed(0)}`}
          color="#2563eb"
        />
        <KPICard
          label="Outstanding"
          value={`LKR ${metrics?.outstandingBalance.toFixed(0)}`}
          color="#dc2626"
        />
      </View>

      {/* Charts */}
      {chartData && (
        <LineChart
          data={chartData}
          width={400}
          height={256}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            color: () => '#2563eb'
          }}
          style={styles.chart}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  kpiGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 16
  },
  chart: { marginVertical: 8 }
});

export default Dashboard;
```

### 4. Real-time Collaboration

```typescript
// services/collaboration.service.ts
import io from 'socket.io-client';

class MobileCollaborationService {
  private socket: any;

  connect(serverUrl: string, userId: string) {
    this.socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      this.socket.emit('user:join', { userId });
    });

    this.socket.on('data:update', (data) => {
      this.handleDataUpdate(data);
    });
  }

  broadcastUpdate(dataType: string, action: string, data: any) {
    this.socket.emit('data:update', { dataType, action, data });
  }
}
```

### 5. Native Notifications

```typescript
// services/notification.service.ts
import PushNotification from 'react-native-notified';

class NotificationService {
  configure() {
    PushNotification.configure({
      onNotification: (notification) => {
        // Handle notification
      },
      requestPermissions: true
    });
  }

  notify(title: string, message: string, type: 'success' | 'error' | 'info') {
    PushNotification.localNotification({
      title,
      message,
      largeIcon: type === 'success' ? 'ic_success' : 'ic_error'
    });
  }
}
```

## Installation Instructions

### iOS Setup

```bash
# Install pods
cd ios
pod install
cd ..

# Run on iOS simulator
npm run ios
```

### Android Setup

```bash
# Start Android emulator first
emulator -avd YourEmulator

# Run on Android
npm run android
```

## API Integration

```typescript
// services/api.service.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: process.env.API_ENDPOINT || 'https://api.example.com'
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run e2e

# Coverage
npm run test:coverage
```

## Build for Production

```bash
# iOS
cd ios
xcodebuild -workspace FujiSanLankaMobile.xcworkspace -scheme FujiSanLankaMobile -configuration Release
cd ..

# Android
cd android
./gradlew assembleRelease
cd ..
```

## Performance Optimization

1. **Code Splitting:** Use dynamic imports
2. **Memory Management:** Clean up listeners
3. **Database Indexing:** Index frequently queried fields
4. **Image Optimization:** Use appropriate sizes
5. **Network:** Implement request caching

## Deployment

- **iOS:** App Store Connect
- **Android:** Google Play Store
- **Firebase:** For analytics and crash reporting