import client from './client';

export interface AppVersionInfo {
  success: boolean;
  platform: string;
  latestVersion: string;
  latestVersionCode: number;
  playStoreUrl: string;
  releaseNotes?: string;
  timestamp?: string;
}

export const getAppVersionInfo = async (): Promise<AppVersionInfo> => {
  const { data } = await client.get<AppVersionInfo>('/app-version');
  return data;
};
