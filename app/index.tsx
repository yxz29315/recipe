import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Button,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";

const API_URL = "https://recipe-beta-six.vercel.app/api/llm";

const FormattedAnswer = ({ answer }: { answer: string }) => {
  const finalAnswerMatch = answer.match(/The final answer is: (.*)/s);
  const finalAnswer = finalAnswerMatch
    ? finalAnswerMatch[1].replace(/\\boxed{([^}]+)}/, "$1").trim()
    : null;

  const stepsPart = finalAnswerMatch
    ? answer.substring(0, finalAnswerMatch.index)
    : answer;
  const steps = stepsPart.split(/(Step \d+:)/).filter((p) => p.trim());

  return (
    <View>
      {steps.map((step, index) => {
        if (step.startsWith("Step")) {
          return (
            <Text key={index} style={styles.stepHeader}>
              {step}
            </Text>
          );
        }
        const lines = step.trim().split("\n");
        return lines.map((line, lineIndex) => {
          const textParts = line.split(/(\$[^$]+\$)/);
          return (
            <Text key={`${index}-${lineIndex}`} style={styles.stepContent}>
              {textParts.map((textPart, i) => {
                if (textPart.startsWith("$") && textPart.endsWith("$")) {
                  return (
                    <Text key={i} style={styles.mathExpression}>
                      {textPart.slice(1, -1)}
                    </Text>
                  );
                }
                return textPart;
              })}
            </Text>
          );
        });
      })}
      {finalAnswer && (
        <View style={styles.finalAnswerContainer}>
          <Text style={styles.finalAnswerText}>The final answer is:</Text>
          <View style={styles.boxedAnswer}>
            <Text style={styles.boxedAnswerText}>{finalAnswer}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default function Index() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      await ImagePicker.requestCameraPermissionsAsync();
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
    } else {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
    }

    if (!result.canceled) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const ask = async () => {
    if (!prompt.trim() && !image) return;
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image }),
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
    <View style={styles.container}>
      <Text style={styles.title}>Ask the model</Text>

      <View style={styles.topButtonContainer}>
        <TouchableOpacity style={styles.topButton} onPress={() => pickImage(true)}>
          <Text style={styles.topButtonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topButton} onPress={() => pickImage(false)}>
          <Text style={styles.topButtonText}>Choose from Library</Text>
        </TouchableOpacity>
      </View>

      {image && (
        <View>
          <Image source={{ uri: image }} style={styles.imagePreview} />
          <Button title="Remove Image" onPress={() => setImage(null)} />
        </View>
      )}

      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Type your question…"
        multiline
        style={styles.input}
      />

      <Button title="Send" onPress={ask} />
      {loading && <ActivityIndicator />}
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!!answer && (
        <View style={styles.answerContainer}>
          <Text style={styles.answerTitle}>Answer</Text>
          <FormattedAnswer answer={answer} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    minHeight: 80,
  },
  errorText: {
    color: "red",
  },
  answerContainer: {
    marginTop: 12,
  },
  answerTitle: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 8,
  },
  stepHeader: {
    fontWeight: "bold",
    marginTop: 8,
    fontSize: 16,
    marginBottom: 4,
  },
  stepContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  finalAnswerContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  finalAnswerText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  boxedAnswer: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 8,
    backgroundColor: "#f0f8ff",
  },
  boxedAnswerText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
  },
  mathExpression: {
    fontStyle: "italic",
    fontFamily: "monospace",
    backgroundColor: "#eee",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  topButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  topButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  topButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});