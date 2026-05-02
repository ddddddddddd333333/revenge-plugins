// UserTracker for Revenge - Bundled (no imports)
const { findByProps } = revenge.modules.finders;
const { after } = revenge.patcher;
const { storage } = revenge;
const { React, ReactNative } = revenge.metro.common;

const { useState } = React;
const { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Vibration, Platform } = ReactNative;

const STORAGE_KEY = "usertracker_v2_ids";
function getTracked() { return storage[STORAGE_KEY] || []; }
function saveTracked(arr) { storage[STORAGE_KEY] = arr; }

function playSound() {
    try { findByProps("playSound", "stopSound")?.playSound("message1", 1); } catch(e) {}
    try { if (Platform.OS !== "web") Vibration.vibrate([0, 100, 80, 200]); } catch(e) {}
}

function showToast(username, content) {
    try {
        const T = findByProps("showToast") ?? findByProps("dispatchToast");
        const msg = `👁️ ${username}: ${content.slice(0, 80)}${content.length > 80 ? "…" : ""}`;
        if (T?.showToast) T.showToast(msg, 0);
        else if (T?.dispatchToast) T.dispatchToast(msg, { type: "info" });
    } catch(e) {}
}

function handleMessage(raw) {
    const message = raw.message ?? raw;
    const author = message.author;
    if (!author?.id || !getTracked().includes(author.id)) return;
    const username = author.global_name ?? author.username ?? "Unknown";
    const content = message.content || "[media]";
    playSound();
    showToast(username, content);
}

let _unpatch = null;

module.exports = {
    onLoad() {
        const MA = findByProps("receiveMessage", "sendMessage");
        if (!MA) return;
        _unpatch = after("receiveMessage", MA, ([msg]) => msg && handleMessage(msg));
    },
    onUnload() {
        _unpatch?.();
        _unpatch = null;
    },
    SettingsComponent() {
        const [input, setInput] = useState("");
        const [tracked, setTracked] = useState(getTracked());
        const [error, setError] = useState("");

        const add = () => {
            const id = input.trim();
            if (!id) return;
            if (!/^\d{17,20}$/.test(id)) { setError("❌ Invalid ID"); return; }
            if (tracked.includes(id)) { setError("⚠️ Already tracking"); return; }
            const updated = [...tracked, id];
            setTracked(updated); saveTracked(updated);
            setInput(""); setError("");
        };

        const remove = (id) => {
            const updated = tracked.filter(u => u !== id);
            setTracked(updated); saveTracked(updated);
        };

        return React.createElement(View, { style: s.container },
            React.createElement(Text, { style: s.title }, "👁️ UserTracker"),
            React.createElement(Text, { style: s.subtitle }, "Get notified when tracked users send messages."),
            React.createElement(View, { style: s.row },
                React.createElement(TextInput, {
                    style: s.input, placeholder: "Paste User ID…",
                    placeholderTextColor: "#555", value: input,
                    onChangeText: t => { setInput(t); setError(""); },
                    keyboardType: "numeric", returnKeyType: "done",
                    onSubmitEditing: add
                }),
                React.createElement(TouchableOpacity, { style: s.addBtn, onPress: add },
                    React.createElement(Text, { style: s.addBtnText }, "Add")
                )
            ),
            !!error && React.createElement(Text, { style: s.error }, error),
            tracked.length === 0
                ? React.createElement(Text, { style: s.empty }, "No users tracked.\nPaste a User ID above.")
                : React.createElement(FlatList, {
                    data: tracked,
                    keyExtractor: item => item,
                    renderItem: ({ item }) => React.createElement(View, { style: s.item },
                        React.createElement(Text, { style: s.itemIcon }, "👤"),
                        React.createElement(Text, { style: s.itemText }, item),
                        React.createElement(TouchableOpacity, { style: s.removeBtn, onPress: () => remove(item) },
                            React.createElement(Text, { style: s.removeBtnText }, "Remove")
                        )
                    )
                }),
            React.createElement(Text, { style: s.hint }, "💡 Long-press username → Copy ID → paste above")
        );
    }
};

const s = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#1e1f22" },
    title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 4 },
    subtitle: { fontSize: 13, color: "#aaa", marginBottom: 16 },
    row: { flexDirection: "row", marginBottom: 4, gap: 8 },
    input: { flex: 1, backgroundColor: "#2b2d31", color: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: "#3f4147" },
    addBtn: { backgroundColor: "#5865f2", borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
    addBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
    error: { color: "#ed4245", fontSize: 12, marginBottom: 8 },
    item: { flexDirection: "row", alignItems: "center", backgroundColor: "#2b2d31", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#3f4147" },
    itemIcon: { fontSize: 16, marginRight: 10 },
    itemText: { flex: 1, color: "#fff", fontSize: 13 },
    removeBtn: { backgroundColor: "#ed4245", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
    removeBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
    empty: { color: "#555", textAlign: "center", marginTop: 40, fontSize: 14 },
    hint: { color: "#555", fontSize: 11, marginTop: 20, textAlign: "center" },
});
