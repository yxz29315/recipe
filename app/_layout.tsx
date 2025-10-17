import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Nomie.ai",
          headerTitleStyle: {
          fontSize: 30,
          fontWeight: "bold",
    },
        }}
      />
      <Stack.Screen
        name="account"
        options={{
          title: "Account",
          headerTitleStyle: {
          fontSize: 30,
          fontWeight: "bold",
    },
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{
          title: "Onboarding",
          headerTitleStyle: {
            fontSize: 30,
            fontWeight: "bold",
          },
        }}
      />
    </Stack>
  );
}
