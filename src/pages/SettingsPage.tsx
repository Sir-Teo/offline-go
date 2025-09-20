export default function SettingsPage() {
  return (
    <section>
      <header style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>Settings</h2>
        <p style={{ margin: "0.35rem 0", opacity: 0.7 }}>
          Configure engines, synchronization, and data export preferences.
        </p>
      </header>
      <p style={{ opacity: 0.65 }}>
        Engine selection, backups, and sync settings will live here.
      </p>
    </section>
  );
}
