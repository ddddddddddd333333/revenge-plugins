// UserTracker Plugin for Revenge v2.1.0
import { findByProps } from "@revenge-mod/modules/finders";
import { after } from "@revenge-mod/patcher";
import { storage } from "@revenge-mod/storage";
import { React, ReactNative } from "@revenge-mod/metro/common";

const { useState } = React;
const {
    View, Text, TextInput, TouchableOpacity,
    FlatList, StyleSheet, Vibration, Platform,
} = ReactNative;

const STORAGE_KEY = "usertracker_v2_ids";

function getTracked() { return storage[STORAGE_KEY] || []; }
function saveTracked(arr) { storage[STORAGE_KEY] = arr; }

// ── Notifications ─────────────────────────────────────────────────────────────
function playSound() {
    try {
        const S = findByProps("playSound", "stopSound");
        S?.playSound("message1", 1);
    } catch (e) {}
    try {
        if (Platform.OS !== "web") Vibration.vibrate([0, 100, 80, 200]);
    } catch (e) {}
}

function sendPush(username, content, guildName, channelName) {
    const title = `👁️ ${username} sent a message`;
    const body = `${guildName} › ${channelName}\n${content.slice(0, 100)}`;

    try {
        const N = findByProps("sendLocalNotification")
            ?? findByProps("presentLocalNotification")
            ?? findByProps("scheduleLocalNotification");
        if (N) {
            const fn = N.sendLocalNotification
                ?? N.presentLocalNotification
                ?? N.scheduleLocalNotification;
            fn({ title, body, sound: "default", priority: "high", vibrate: [0, 100, 80, 200] });
            return;
        }
    } catch (e) {}

    try {
        if (typeof Notification !== "undefined") {
            const show = () => new Notification(title, {
                body,
                icon: "https://discord.com/assets/favicon.ico",
            });
            if (Notification.permission === "granted") show();
            else if (Notification.permission !== "denied")
                Notification.requestPermission().then(p => p === "granted" && show());
        }
    } catch (e) {}
}

function showToast(username, content) {
    try {
        const T = findByProps("showToast", "open")
            ?? findByProps("dispatchToast")
            ?? findByProps("showSimpleToast");
        const msg = `👁️ ${username}: ${content.slice(0, 80)}${content.length > 80 ? "…" : ""}`;
        if (T?.showToast) T.showToast(msg, T.ToastStyle?.NORMAL ?? 0);
        else if (T?.dispatchToast) T.dispatchToast(msg, { type: "info" });
        else if (T?.showSimpleToast) T.showSimpleToast({ title: msg });
    } catch (e) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getChannelInfo(channelId) {
    try {
        const CS = findByProps("getChannel", "getDMFromUserId");
        const GS = findByProps("getGuild", "getGuildCount");
        const channel = CS?.getChannel(channelId);
        if (!channel) return { guildName: "Unknown Server", channelName: "Unknown Channel" };
        const channelName = channel.name ? `#${channel.name}` : "DM";
        const guildName = channel.guild_id
            ? (GS?.getGuild(channel.guild_id)?.name ?? "Unknown Server")
            : "Direct Message";
        return { guildName, channelName };
    } catch (e) {
        return { guildName: "Unknown Server", channelName: "Unknown Channel" };
    }
}

function handleMessage(raw) {
    const message = raw.message ?? raw;
    const author = message.author;
    if (!author?.id) return;

    if (!getTracked().includes(author.id)) return;

    const username = author.global_name ?? author.username ?? "Unknown";
    const content = message.content || "[image / embed / file]";
    const { guildName, channelName } = getChannelInfo(message.channel_id);

    playSound();
    sendPush(username, content, guildName, channelName);
    showToast(username, content);

    console.log(`[UserTracker] Alert: ${username} in ${guildName} › ${channelName}`);
}

// ── Plugin ────────────────────────────────────────────────────────────────────
let _unpatch = null;

export default {
    onStart() {
        const MA = findByProps("receiveMessage", "sendMessage");
        if (!MA) { console.error("[UserTracker] MessageActions not found."); return; }
        _unpatch = after("receiveMessage", MA, ([msg]) => msg && handleMessage(msg));
        console.log("[UserTracker] Started. Tracking:", getTracked());
    },

    onStop() {
        _unpatch?.();
        _unpatch = null;
        console.log("[UserTracker] Stopped.");
    },

    SettingsComponent() {
        const [input, setInput] = useState("");
        const [tracked, setTracked] = useState(getTracked());
        const [error, setError] = useState("");

        const add = () => {
            const id = input.trim();
            if (!id) return;
            if (!/^\d{17,20}$/.test(id)) {
                setError("❌ Invalid ID — must be 17-20 digits");
                return;
            }
            if (tracked.includes(id)) {
                setError("⚠️ Already tracking this user");
                return;
            }
            const updated = [...tracked, id];
            setTracked(updated);
            saveTracked(updated);
            setInput("");
            setError("");
        };

        const remove = (id) => {
            const updated = tracked.filter(u => u !== id);
            setTracked(updated);
            saveTracked(updated);
        };

        return (
            <View style={s.container}>
                <Text style={s.title}>👁️ UserTracker</Text>
                <Text style={s.subtitle}>
                    Get notified with sound + push when a tracked user sends a message anywhere.
                </Text>

                <View style={s.row}>
                    <TextInput
                        style={s.input}
                        placeholder="Paste User ID (17-20 digits)…"
                        placeholderTextColor="#555"
                        value={input}
                        onChangeText={t => { setInput(t); setError(""); }}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={add}
                    />
                    <TouchableOpacity style={s.addBtn} onPress={add}>
                        <Text style={s.addBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {!!error && <Text style={s.error}>{error}</Text>}

                <Text style={s.count}>
                    {tracked.length === 0 ? "No users tracked" : `Tracking ${tracked.length} user${tracked.length > 1 ? "s" : ""}`}
                </Text>

                {tracked.length === 0 ? (
                    <Text style={s.empty}>
                        Paste a User ID above to start tracking.{"\n"}
                        Long-press a username in Discord → Copy ID
                    </Text>
                ) : (
                    <FlatList
                        data={tracked}
                        keyExtractor={item => item}
                        renderItem={({ item }) => (
                            <View style={s.item}>
                                <Text style={s.itemIcon}>👤</Text>
                                <Text style={s.itemText}>{item}</Text>
                                <TouchableOpacity style={s.removeBtn} onPress={() => remove(item)}>
                                    <Text style={s.removeBtnText}>Remove</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    />
                )}

                <Text style={s.hint}>
                    💡 Long-press a username in Discord → Copy ID → paste above
                </Text>
            </View>
        );
    },
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#1e1f22" },
    title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 4 },
    subtitle: { fontSize: 13, color: "#aaa", marginBottom: 16, lineHeight: 18 },
    row: { flexDirection: "row", marginBottom: 4, gap: 8 },
    input: {
        flex: 1, backgroundColor: "#2b2d31", color: "#fff",
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
        fontSize: 14, borderWidth: 1, borderColor: "#3f4147",
    },
    addBtn: {
        backgroundColor: "#5865f2", borderRadius: 10,
        paddingHorizontal: 18, justifyContent: "center", alignItems: "center",
    },
    addBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
    error: { color: "#ed4245", fontSize: 12, marginBottom: 10 },
    count: { color: "#5865f2", fontSize: 12, marginBottom: 10, fontWeight: "600" },
    item: {
        flexDirection: "row", alignItems: "center", backgroundColor: "#2b2d31",
        borderRadius: 10, padding: 12, marginBottom: 8,
        borderWidth: 1, borderColor: "#3f4147",
    },
    itemIcon: { fontSize: 16, marginRight: 10 },
    itemText: { flex: 1, color: "#fff", fontSize: 13, fontFamily: "monospace" },
    removeBtn: { backgroundColor: "#ed4245", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
    removeBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
    empty: { color: "#555", textAlign: "center", marginTop: 40, fontSize: 14, lineHeight: 22 },
    hint: { color: "#555", fontSize: 11, marginTop: 20, textAlign: "center", lineHeight: 16 },
});
