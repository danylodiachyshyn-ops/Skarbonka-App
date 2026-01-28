# Skarbonka App

A minimalist digital piggy bank mobile application built with React Native (Expo), Supabase, and NativeWind.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Add your Supabase project URL and anon key:
     ```
     EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
     EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

3. **Set up Supabase database:**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the SQL script from `supabase-schema.sql`

4. **Start the development server:**
   ```bash
   npm start
   ```

   Then press:
   - `i` for iOS simulator
   - `a` for Android emulator
   - `w` for web browser

## 📁 Project Structure

```
SkarbonkaApp/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main app screens
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/         # Reusable components
│   ├── hooks/             # Custom hooks & Zustand stores
│   ├── lib/               # Utilities (Supabase client, etc.)
│   └── styles/            # Global styles
├── assets/                # Images, fonts, etc.
└── supabase-schema.sql    # Database schema
```

## 🛠 Tech Stack

- **Framework:** React Native with Expo
- **Navigation:** Expo Router
- **Language:** TypeScript
- **Styling:** NativeWind (Tailwind CSS)
- **Backend:** Supabase (PostgreSQL)
- **State Management:** Zustand
- **Icons:** Lucide React Native
- **Animations:** React Native Reanimated

## 📝 Database Schema

The app uses three main tables:
- `profiles` - User profiles
- `piggy_banks` - Savings goals
- `transactions` - Deposit records

See `supabase-schema.sql` for the complete schema with RLS policies.

## 🎨 Design Philosophy

The app follows a minimalist "Neo-bank" aesthetic inspired by Monobank and Revolut:
- Clean backgrounds
- Bold typography
- Glassmorphism effects
- Fluid animations
- Swipeable card interface

## 📱 Features

- ✅ User authentication (Email/Password)
- ✅ Create multiple piggy banks
- ✅ Swipe between piggy banks
- ✅ Add money transactions
- ✅ Visual progress tracking
- ⏳ Game feature (coming soon)

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Secure authentication via Supabase Auth

## 📄 License

Private project - All rights reserved
