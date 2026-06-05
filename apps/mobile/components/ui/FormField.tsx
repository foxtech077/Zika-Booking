import { View, Text, TextInput, type TextInputProps } from "react-native";

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function FormField({ label, error, ...props }: FormFieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <TextInput
        className={`border rounded-lg px-4 py-3 text-base text-gray-900 bg-white ${error ? "border-red-500" : "border-gray-300"}`}
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        {...props}
      />
      {error ? <Text className="text-xs text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
}
