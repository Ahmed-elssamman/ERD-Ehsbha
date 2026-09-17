import { DigestSnapshotVersion, NotificationKind } from '@ehsbha/shared-types';

export interface DigestHourObservation { hour: number; earningsPerTripHourPiastres: number; tripCount: number }
export interface DigestAppObservation { appId: string; appName: string; earningsPiastres: number; tripCount: number }
export interface DigestAreaObservation { areaId: string; areaName: string; earningsPerPaidKmPiastres: number; tripCount: number }
export interface DigestInsights {
  todayTargetPiastres: number | null; goalTargetPiastres: number | null; earnedBeforeTodayPiastres: number | null;
  goalStartDate: string | null; goalEndDate: string | null; remainingGoalDays: number | null;
  bestStartHour: DigestHourObservation | null; highestAppTotal: DigestAppObservation | null;
  lowerAreaRate: DigestAreaObservation | null; yesterdayEmptyRatioBp: number | null; yesterdayNetPiastres: number | null;
}
export interface DigestSnapshot {
  kind: NotificationKind.DailyDigest; version: DigestSnapshotVersion.Current; snapshotDate: string;
  windowStartDate: string; windowEndDate: string; sourceTripCount: number | null; insights: DigestInsights;
}
export interface DigestMessage { title: string; body: string }
