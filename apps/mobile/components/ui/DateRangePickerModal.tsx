import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const GREEN = "#1D8D2B";
const GREEN_LIGHT = "#E8F5E9";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

const CAL_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CAL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function calToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isBeforeToday(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

function isInUnavailable(
  ds: string,
  ranges?: { start: string; end: string }[]
): boolean {
  if (!ranges || ranges.length === 0) return false;
  return ranges.some((r) => {
    const s = r.start.split("T")[0]!;
    const e = r.end.split("T")[0]!;
    return ds >= s && ds <= e;
  });
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const arr: (Date | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
  return arr;
}

function fmtDisplay(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

export function calcNights(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const s = new Date(startStr).getTime();
  const e = new Date(endStr).getTime();
  const diff = Math.round((e - s) / 86400000);
  return Math.max(1, diff);
}

export interface DateRangePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
  initialStartDate?: string | null;
  initialEndDate?: string | null;
  title?: string;
  isCar?: boolean;
  unavailableRanges?: { start: string; end: string }[];
}

export default function DateRangePickerModal({
  visible,
  onClose,
  onConfirm,
  initialStartDate,
  initialEndDate,
  title,
  isCar = false,
  unavailableRanges = [],
}: DateRangePickerModalProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [selStart, setSelStart] = useState<string | null>(initialStartDate ?? null);
  const [selEnd, setSelEnd] = useState<string | null>(initialEndDate ?? null);

  const [pickupHr, setPickupHr] = useState("10");
  const [pickupMin, setPickupMin] = useState("00");
  const [returnHr, setReturnHr] = useState("10");
  const [returnMin, setReturnMin] = useState("00");

  useEffect(() => {
    if (visible) {
      setSelStart(initialStartDate ?? null);
      setSelEnd(initialEndDate ?? null);
      if (initialStartDate) {
        const parts = initialStartDate.split("-");
        if (parts.length === 3) {
          setViewYear(Number(parts[0]));
          setViewMonth(Number(parts[1]) - 1);
        }
      }
    }
  }, [visible, initialStartDate, initialEndDate]);

  function resetPicker() {
    setSelStart(null);
    setSelEnd(null);
    setPickupHr("10");
    setPickupMin("00");
    setReturnHr("10");
    setReturnMin("00");
  }

  const monthDays = buildMonthGrid(viewYear, viewMonth);
  const DAY_SIZE = (SCREEN_WIDTH - 32) / 7;

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDayPress(d: Date) {
    const ds = calToStr(d);
    if (!selStart || (selStart && selEnd)) {
      setSelStart(ds);
      setSelEnd(null);
    } else {
      if (ds <= selStart) {
        setSelStart(ds);
        setSelEnd(null);
      } else {
        setSelEnd(ds);
      }
    }
  }

  type DayState = "start" | "end" | "range" | "normal" | "disabled";
  function getDayState(d: Date): DayState {
    const ds = calToStr(d);
    if (isBeforeToday(d) || isInUnavailable(ds, unavailableRanges)) return "disabled";
    if (ds === selStart) return "start";
    if (ds === selEnd) return "end";
    if (selStart && selEnd && ds > selStart && ds < selEnd) return "range";
    return "normal";
  }

  function handleConfirm() {
    if (!selStart || !selEnd) return;
    if (isCar) {
      const pu = new Date(
        `${selStart}T${pickupHr.padStart(2, "0")}:${pickupMin.padStart(2, "0")}:00`
      ).toISOString();
      const rt = new Date(
        `${selEnd}T${returnHr.padStart(2, "0")}:${returnMin.padStart(2, "0")}:00`
      ).toISOString();
      onConfirm(pu, rt);
    } else {
      onConfirm(selStart, selEnd);
    }
    onClose();
  }

  const canConfirm = !!(selStart && selEnd);
  const numNights = selStart && selEnd ? calcNights(selStart, selEnd) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>
            {title ?? (isCar ? "Select Rental Period" : "Select Dates")}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color={TEXT} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Month navigation */}
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color={GREEN} />
            </TouchableOpacity>
            <Text style={s.monthTitle}>
              {CAL_MONTHS[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={GREEN} />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={{ flexDirection: "row", paddingHorizontal: 16 }}>
            {CAL_WEEKDAYS.map((w) => (
              <Text key={w} style={[s.dow, { width: DAY_SIZE }]}>
                {w}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16 }}>
            {monthDays.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={{ width: DAY_SIZE, height: 44 }} />;
              const st = getDayState(d);
              const isStart = st === "start";
              const isEnd = st === "end";
              const isRange = st === "range";
              const isDisabled = st === "disabled";

              return (
                <View
                  key={i}
                  style={{
                    width: DAY_SIZE,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isRange && <View style={s.rangeHighlight} />}
                  {isEnd && selStart && <View style={s.endHighlight} />}
                  {isStart && selEnd && <View style={s.startHighlight} />}

                  <TouchableOpacity
                    onPress={() => !isDisabled && handleDayPress(d)}
                    disabled={isDisabled}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: isStart || isEnd ? GREEN : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: isStart || isEnd ? "700" : "400",
                        color: isDisabled
                          ? "#D1D5DB"
                          : isStart || isEnd
                            ? "#fff"
                            : TEXT,
                      }}
                    >
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Status hint */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            {!selStart && (
              <Text style={s.hintText}>
                Tap to select your {isCar ? "pickup" : "check-in"} date
              </Text>
            )}
            {selStart && !selEnd && (
              <Text style={s.hintText}>
                Now tap your {isCar ? "return" : "check-out"} date (min 1 night)
              </Text>
            )}
            {selStart && selEnd && (
              <View style={s.selectedRangeBox}>
                <Ionicons name="calendar-outline" size={18} color={GREEN} />
                <Text style={s.selectedRangeText}>
                  {fmtDisplay(selStart)} – {fmtDisplay(selEnd)}
                  {!isCar
                    ? ` · ${numNights} night${numNights !== 1 ? "s" : ""}`
                    : ""}
                </Text>
              </View>
            )}
          </View>

          {/* Time inputs for car rentals */}
          {isCar && selStart && selEnd && (
            <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT }}>Set Times</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={s.timeBox}>
                  <Text style={s.timeLabel}>Pickup time</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TextInput
                      value={pickupHr}
                      onChangeText={(v) => setPickupHr(v.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={s.timeInput}
                    />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: TEXT }}>:</Text>
                    <TextInput
                      value={pickupMin}
                      onChangeText={(v) => setPickupMin(v.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={s.timeInput}
                    />
                  </View>
                </View>
                <View style={s.timeBox}>
                  <Text style={s.timeLabel}>Return time</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TextInput
                      value={returnHr}
                      onChangeText={(v) => setReturnHr(v.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={s.timeInput}
                    />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: TEXT }}>:</Text>
                    <TextInput
                      value={returnMin}
                      onChangeText={(v) => setReturnMin(v.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={s.timeInput}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Action buttons */}
          <View style={s.actionsRow}>
            {selStart && (
              <TouchableOpacity style={s.clearBtn} onPress={resetPicker}>
                <Text style={s.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.confirmBtn, !canConfirm && s.confirmBtnDisabled]}
              disabled={!canConfirm}
              onPress={handleConfirm}
            >
              <Text style={s.confirmBtnText}>Apply Dates</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  navBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: GREEN_LIGHT,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },
  dow: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    paddingBottom: 6,
  },
  rangeHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 7,
    bottom: 7,
    backgroundColor: GREEN_LIGHT,
  },
  endHighlight: {
    position: "absolute",
    left: 0,
    right: "50%",
    top: 7,
    bottom: 7,
    backgroundColor: GREEN_LIGHT,
  },
  startHighlight: {
    position: "absolute",
    left: "50%",
    right: 0,
    top: 7,
    bottom: 7,
    backgroundColor: GREEN_LIGHT,
  },
  hintText: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
  },
  selectedRangeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: GREEN_LIGHT,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  selectedRangeText: {
    fontSize: 14,
    fontWeight: "700",
    color: GREEN,
  },
  timeBox: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  timeLabel: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "600",
    marginBottom: 8,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    width: 44,
    textAlign: "center",
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  clearBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
