import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Smartphone, Moon, Globe, ChevronRight } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('deliveryAppSettings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
    return {
      pushNotifications: true,
      emailAlerts: false,
      sound: true,
      vibration: true,
      darkMode: false,
      language: "English",
    };
  });

  React.useEffect(() => {
    localStorage.setItem('deliveryAppSettings', JSON.stringify(settings));
    
    // Apply dark mode immediately
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    const titles = {
      pushNotifications: "Push Notifications",
      sound: "Sound & Vibration",
      darkMode: "Dark Mode"
    };
    const title = titles[key] || "Settings";
    toast.success(`${title} updated`);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10 transition-colors">
        <div className="flex items-center p-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="p-2 rounded-full hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-700 transition-colors mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="ds-h3 text-gray-900 dark:text-white">App Settings</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Notifications */}
        <section>
          <h2 className="text-sm uppercase font-bold text-gray-500 dark:text-gray-400 mb-3 tracking-wider ml-1">Notifications</h2>
          <Card className="divide-y divide-gray-100 dark:divide-gray-700 dark:bg-gray-800 transition-colors border-none">
            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-700/50 transition-colors" onClick={() => toggleSetting('pushNotifications')}>
              <div className="flex items-center">
                <Bell size={20} className="text-gray-400 dark:text-gray-300 mr-3" />
                <div>
                  <h4 className="font-medium text-gray-800 dark:text-gray-100">Push Notifications</h4>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${settings.pushNotifications ? 'bg-primary' : 'bg-gray-300'}`}>
                <div className={`bg-white dark:bg-gray-800 w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${settings.pushNotifications ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
            </div>
            
            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-700/50 transition-colors" onClick={() => toggleSetting('sound')}>
              <div className="flex items-center">
                <Smartphone size={20} className="text-gray-400 dark:text-gray-300 mr-3" />
                <div>
                  <h4 className="font-medium text-gray-800 dark:text-gray-100">Sound & Vibration</h4>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${settings.sound ? 'bg-primary' : 'bg-gray-300'}`}>
                <div className={`bg-white dark:bg-gray-800 w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${settings.sound ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
            </div>
          </Card>
        </section>

        {/* General */}
        <section>
          <h2 className="text-sm uppercase font-bold text-gray-500 dark:text-gray-400 mb-3 tracking-wider ml-1">General</h2>
          <Card className="divide-y divide-gray-100 dark:divide-gray-700 dark:bg-gray-800 transition-colors border-none">
            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center">
                <Globe size={20} className="text-gray-400 dark:text-gray-300 mr-3" />
                <div>
                  <h4 className="font-medium text-gray-800 dark:text-gray-100">Language</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{settings.language}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-300" />
            </div>

            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-700/50 transition-colors" onClick={() => toggleSetting('darkMode')}>
              <div className="flex items-center">
                <Moon size={20} className="text-gray-400 dark:text-gray-300 mr-3" />
                <div>
                  <h4 className="font-medium text-gray-800 dark:text-gray-100">Dark Mode</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Easier on the eyes at night</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${settings.darkMode ? 'bg-primary' : 'bg-gray-300'}`}>
                <div className={`bg-white dark:bg-gray-800 w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${settings.darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
            </div>
          </Card>
        </section>

        <div className="text-center pt-8">
          <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600">
            Clear Cache (45 MB)
          </Button>
          <p className="text-xs text-gray-400 mt-2">App Version 1.2.0 (Build 450)</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
