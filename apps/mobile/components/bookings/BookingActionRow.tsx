import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { K } from "../../constants/theme";

/**
 * Presentational-only action row for the booking detail screen. The screen
 * owns every handler and every eligibility/loading flag — this component
 * only renders what's passed in.
 */
export function BookingActionRow({
  onMessage,
  canCancel,
  cancelled,
  isCancelling,
  onCancel,
  onShare,
}: {
  onMessage: () => void;
  canCancel: boolean;
  cancelled: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  onShare: () => void;
}) {
  return (
    <View style={a.wrap}>
      {/* Message Guest — same disabled-stub behavior as before */}
      <TouchableOpacity style={[a.msgBtn, a.msgBtnDisabled]} activeOpacity={0.85} onPress={onMessage}>
        <Feather name="message-circle" size={18} color="#fff" />
        <Text style={a.msgBtnText}>Message Guest</Text>
      </TouchableOpacity>

      {canCancel && !cancelled && (
        <TouchableOpacity
          style={[a.cancelBtn, isCancelling && a.cancelBtnDisabled]}
          onPress={onCancel}
          disabled={isCancelling}
          activeOpacity={0.85}
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color={K.colors.error} />
          ) : (
            <>
              <Feather name="x-circle" size={16} color={K.colors.error} />
              <Text style={a.cancelBtnText}>Cancel Booking</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {cancelled && (
        <View style={a.cancelledBadge}>
          <Feather name="x-circle" size={16} color="#DC2626" />
          <Text style={a.cancelledBadgeText}>Booking Cancelled</Text>
        </View>
      )}

      <TouchableOpacity style={a.shareBtn} onPress={onShare} activeOpacity={0.85}>
        <Feather name="share-2" size={15} color={K.colors.textMuted} />
        <Text style={a.shareBtnText}>Share Reservation Details</Text>
      </TouchableOpacity>
    </View>
  );
}

const a = StyleSheet.create({
  wrap: { gap: 12 },
  msgBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: K.colors.darkGreen, borderRadius: K.radius.lg,
    paddingVertical: 16, ...K.shadow.md,
  },
  msgBtnDisabled: { opacity: 0.55 },
  msgBtnText: { fontSize: K.font.base, fontWeight: "700", color: "#fff" },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: "#FECACA", borderRadius: K.radius.lg,
    paddingVertical: 14, backgroundColor: "#FEF2F2",
  },
  cancelBtnDisabled: { opacity: 0.55 },
  cancelBtnText: { fontSize: K.font.base, fontWeight: "700", color: K.colors.error },
  cancelledBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: "#FECACA", borderRadius: K.radius.lg,
    paddingVertical: 14, backgroundColor: "#FEF2F2",
  },
  cancelledBadgeText: { fontSize: K.font.base, fontWeight: "700", color: "#DC2626" },
  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: K.colors.border, borderRadius: K.radius.lg,
    paddingVertical: 13, backgroundColor: K.colors.bgCard,
  },
  shareBtnText: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMuted },
});
