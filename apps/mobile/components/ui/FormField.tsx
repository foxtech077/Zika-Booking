import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function FormField({ label, error, secureTextEntry, ...props }: FormFieldProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const showToggle = secureTextEntry !== undefined;

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <View className="relative justify-center">
        <TextInput
          className={`border rounded-lg pl-4 py-3 text-base text-gray-900 bg-white ${
            error ? "border-red-500" : "border-gray-300"
          } ${showToggle ? "pr-12" : "pr-4"}`}
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          {...props}
          secureTextEntry={isSecure}
        />
        {showToggle && (
          <TouchableOpacity
            className="absolute right-3 p-1"
            onPress={() => setIsSecure(!isSecure)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSecure ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#6b7280"
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text className="text-xs text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
}
