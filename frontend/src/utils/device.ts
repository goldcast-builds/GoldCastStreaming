import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_KEY = "goldcast_device_id";

function genId(): string {
  // Simple RFC4122-ish uuid v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = genId();
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
