import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { API_BASE_URL } from "../config/api";
import { clearSessionToken, getSessionToken } from "../config/session";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    let heartbeatInProgress = false;
    const heartbeat = async () => {
      if (heartbeatInProgress || AppState.currentState !== "active") return;
      heartbeatInProgress = true;
      try {
        const token = await getSessionToken();
        if (!token) return;
        const response = await fetch(`${API_BASE_URL}/usuario/sessao-atual/atividade`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 401) {
          await AsyncStorage.removeItem("@usuario_logado");
          await clearSessionToken();
          router.replace("/");
        } else if (!response.ok) {
          console.error("Não foi possível atualizar a atividade da sessão.");
        }
      } catch (error) {
        console.error("Erro ao atualizar a atividade da sessão:", error);
      } finally {
        heartbeatInProgress = false;
      }
    };

    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 5 * 60 * 1000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void heartbeat();
    });
    const notificationSubscription = Platform.OS === "web"
      ? null
      : Notifications.addNotificationResponseReceivedListener((response) => {
        const route = response.notification.request.content.data?.route;
        if (typeof route === "string" && [
          "/chat",
          "/privacidade_seguranca",
          "/anuncio_listagem",
          "/minhas_avaliacoes",
          "/home",
        ].includes(route)) {
          router.push(route as never);
        }
      });

    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
      notificationSubscription?.remove();
    };
  }, [router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
