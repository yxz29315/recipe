import React, { useState } from "react";
import { ActivityIndicator, Button, Text, TextInput, View } from "react-native";

const API_URL = "https://recipe-beta-six.vercel.app/api/llm";

export default function Index() {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setAnswer(data.text);
    } catch (e: any) {
      setError(e.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Ask the model</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Type your question…"
        multiline
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 12,
          borderRadius: 8,
          minHeight: 80,
        }}
      />
      <Button title="Send" onPress={ask} />
      {loading && <ActivityIndicator />}
      {!!error && <Text style={{ color: "red" }}>{error}</Text>}
      {!!answer && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "600" }}>Answer</Text>
          <Text>{answer}</Text>
        </View>
      )}
    </View>
  );
}
