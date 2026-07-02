import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from "react-native";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ title, loading, variant = "primary", disabled, ...props }: ButtonProps) {
  const base = "rounded-lg px-6 py-4 items-center flex-row justify-center";
  const variants = {
    primary: "bg-primary",
    secondary: "bg-white border border-primary",
    ghost: "bg-transparent",
  };
  const textVariants = {
    primary: "text-white font-semibold text-base",
    secondary: "text-primary font-semibold text-base",
    ghost: "text-primary font-semibold text-base",
  };

  return (
    <TouchableOpacity
      className={`${base} ${variants[variant]} ${disabled || loading ? "opacity-60" : ""}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <ActivityIndicator size="small" color={variant === "primary" ? "#fff" : "#16a34a"} className="mr-2" />}
      <Text className={textVariants[variant]}>{title}</Text>
    </TouchableOpacity>
  );
}
