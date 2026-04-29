# Complete Project Reconstruction Prompt

## 1. PROJECT OVERVIEW

This is a **full-stack mobile-web hybrid service booking and shop management platform** built with React, Vite, Firebase, and Supabase. The app serves two main user types: **Customers** (who book services at shops) and **Shop Owners** (who manage their businesses). The platform includes real-time booking notifications, video sharing, reviews, campaigns, order management, and custom website building capabilities.

### Technology Stack:
- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Authentication**: Firebase Authentication
- **Backend Database**: Supabase (PostgreSQL)
- **Notifications**: OneSignal (push notifications) + Firebase Cloud Messaging
- **Native Mobile**: Capacitor 7 (supports Android/iOS)
- **UI Components**: Radix UI with Tailwind CSS
- **State Management**: React Context API
- **Icons**: Lucide React
- **Forms**: React Hook Form with Zod validation
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Payment**: Razorpay integration
- **Video**: React Three Fiber for 3D elements

---

## 2. PROJECT STRUCTURE

```
src/
├── App.tsx                          # Main app router and layout
├── main.tsx                         # Entry point
├── index.css                        # Global styles
├── components/
│   ├── ui/                         # Radix UI components
│   ├── HomePage.tsx                # Customer home page
│   ├── ProfilePage.tsx             # User profile and booking history
│   ├── ShopDetailsPage.tsx         # Shop detail view
│   ├── BarberPortal.tsx            # Shop owner dashboard
│   ├── StaffPortal.tsx             # Admin panel
│   ├── BookingModalNew.tsx         # Booking flow modal
│   ├── ShortVideosPage.tsx         # Video feed page
│   ├── PublishedWebsite.tsx        # Published shop websites
│   ├── WebsiteBuilder.tsx          # Website builder interface
│   ├── campaigns/                  # Campaign components
│   ├── ProductionBooking/          # Advanced booking flow
│   └── ...other components
├── contexts/
│   ├── AuthContext.tsx             # Firebase auth + role management
│   ├── UserProfileContext.tsx      # Current user profile data
│   ├── OneSignalContext.tsx        # Notification initialization
│   ├── ReminderAlarmContext.tsx    # Device alarm reminders
│   └── BookingNegotiationContext.tsx
├── lib/
│   ├── supabase.ts                 # Supabase client init
│   ├── firebase.ts                 # Firebase config
│   ├── supabase-*.ts               # Individual Supabase table modules
│   ├── onesignal-messaging.ts      # OneSignal integration
│   ├── shops-storage.ts            # Shop data management
│   ├── bookings-storage.ts         # Booking management
│   ├── booking-notification-system.ts
│   ├── alarm-scheduler.ts          # Native device alarms
│   ├── geolocation.ts              # Location services
│   └── ...other utilities
└── types/
    └── index.ts                    # TypeScript type definitions
```

---

## 3. SUPABASE DATABASE & DATA MODELS

Supabase serves as the primary backend database. The app uses PostgreSQL with Row Level Security (RLS).

### Key Tables:

#### **shops** Table
Stores all shop information. Fields include:
- `id` (UUID, primary key)
- `name` (string)
- `location`, `address`, `village`, `district`, `state`, `country` (location data)
- `owner_name`, `owner_email`, `owner_phone` (owner contact)
- `about` (text description)
- `shop_image_url`, `shop_interior_video_url`, `location_image_url` (media URLs)
- `location_map_link` (Google Maps link)
- `latitude`, `longitude` (geo coordinates)
- `password` (for shop owner authentication in portal)
- `is_open` (boolean - shop status)
- `token_booking_paused` (boolean - pause bookings)
- `opening_time`, `closing_time` (business hours in HH:MM format)
- `barber_members` (JSON array of staff)
- `services` (JSON array of services with name and price)
- `category` (string - predefined or custom)
- `category_id` (optional FK to categories)
- `last_ping_time` (timestamp for online status)
- `display_status` ('online' | 'recently_online' | 'offline')
- `is_pinned` (boolean)
- `pin_order` (display order)
- `is_website_builder_enabled` (boolean)
- `is_token_booking_enabled` (boolean)
- `created_at` (timestamp)

Example barber_members structure:
```json
[
  {
    "id": "string",
    "name": "string",
    "experience": "string",
    "imageUrl": "string"
  }
]
```

Example services structure:
```json
[
  {
    "id": "string",
    "name": "string",
    "price": "string"
  }
]
```

#### **bookings** Table
Customer bookings for services. Fields:
- `id` (UUID, primary key)
- `shop_id` (FK to shops)
- `user_id` (FK to Firebase auth user)
- `service_name` (string)
- `service_price` (string)
- `time_slot` (HH:MM format)
- `token_number` (number - queue position)
- `user_name` (string)
- `user_phone` (string)
- `booking_date` (date)
- `status` ('pending' | 'in-progress' | 'completed')
- `created_at` (timestamp)

#### **user_profiles** Table
User profile information. Fields:
- `id` (UUID, primary key)
- `user_id` (FK to Firebase auth)
- `email` (string, unique)
- `name` (string)
- `phone` (string)
- `image_url` (profile photo)
- `unique_profile_name` (custom profile slug)
- `address`, `village`, `district`, `state`, `country` (location)
- `latitude`, `longitude` (geo coordinates)
- `created_at`, `updated_at` (timestamps)

#### **reviews** Table
Shop reviews from customers. Fields:
- `id` (UUID, primary key)
- `shop_id` (FK)
- `user_id` (FK)
- `user_email` (string)
- `user_name` (string)
- `rating` (number 1-5)
- `title` (string)
- `review_text` (text)
- `image_url` (optional review image)
- `is_verified_customer` (boolean)
- `helpful_count` (number)
- `created_at`, `updated_at` (timestamps)

#### **review_replies** Table
Shop owner replies to reviews. Fields:
- `id` (UUID)
- `review_id` (FK)
- `shop_id` (FK)
- `owner_id` (FK)
- `reply_text` (text)
- `created_at`, `updated_at` (timestamps)

#### **bookings** (booking history)
Same structure as bookings table but tracks all historical bookings.

#### **videos** Table
Short-form videos (like TikTok). Fields:
- `id` (UUID)
- `uploader_name` (string)
- `uploader_type` ('customer' | 'shop_owner')
- `uploader_id` (FK)
- `video_url` (storage URL)
- `duration` (seconds, max 60)
- `caption` (string)
- `likes` (number)
- `liked_by` (JSON array of user IDs)
- `created_at` (timestamp)

#### **categories** Table
Shop categories. Fields:
- `id` (UUID)
- `name` (string)
- `slug` (string, unique)
- `icon` (emoji or icon name)
- `description` (optional)
- `display_order` (number)
- `created_at` (timestamp)

#### **world_chat_messages** Table
Global chat for all users. Fields:
- `id` (UUID)
- `user_name` (string)
- `user_email` (string, optional)
- `user_id` (FK, optional)
- `message` (text)
- `image_url` (optional)
- `created_at` (timestamp)
- `expires_at` (timestamp - messages auto-delete)

#### **orders** Table
Customer orders. Fields:
- `id` (UUID)
- `shop_id` (FK)
- `customer_id` (FK)
- `customer_name` (string)
- `customer_phone` (string)
- `order_amount` (number)
- `order_description` (string, optional)
- `status` ('pending' | 'accepted' | 'rejected' | 'ready_for_collection' | 'collected')
- `rejection_reason` (string, optional)
- `rejection_notes` (string, optional)
- `created_at`, `updated_at` (timestamps)
- `accepted_at`, `rejected_at`, `ready_at`, `collected_at` (timestamps)
- `expires_at` (timestamp)

#### **featured_products** Table
Featured/promoted products in shops. Fields:
- `id` (UUID)
- `shop_id` (FK)
- `title` (string)
- `price` (number)
- `image_url` (string)
- `description` (string, optional)
- `is_active` (boolean)
- `display_order` (number)
- `created_at`, `updated_at` (timestamps)

#### **shop_offers** Table
Time-limited offers from shops. Fields:
- `id` (UUID)
- `shop_id` (FK)
- `title` (string)
- `description` (string, optional)
- `image_url` (string, optional)
- `discount_percentage` (number, optional)
- `discount_amount` (number, optional)
- `valid_from` (timestamp)
- `valid_until` (timestamp)
- `is_active` (boolean)
- `display_order` (number)
- `created_at`, `updated_at` (timestamps)

#### **shop_websites** Table
Published websites for shops. Fields:
- `id` (UUID)
- `shop_id` (FK)
- `shop_slug` (string, unique)
- `is_published` (boolean)
- `components` (JSON array of website components)
- `vercel_url` (string, optional - deployed URL)
- `custom_domain` (string, optional)
- `views_count` (number)
- `created_at`, `updated_at` (timestamps)

#### **campaigns** Table
Marketing campaigns. Fields:
- `id` (UUID)
- `shop_id` (FK)
- `title` (string)
- `message` (text)
- `image_url` (string, optional)
- `target_country`, `target_state`, `target_district`, `target_village` (location targeting)
- `scheduled_at` (timestamp, optional - for scheduled campaigns)
- `sent_at` (timestamp, optional)
- `status` ('draft' | 'scheduled' | 'sent')
- `created_at`, `updated_at` (timestamps)

#### **shop_owner_plans** Table
Subscription plans for shop owners. Fields:
- `id` (UUID)
- `user_email` (string)
- `plan_name` ('basic' | 'pro' | 'enterprise')
- `status` ('active' | 'cancelled')
- `valid_from`, `valid_until` (timestamps)
- `created_at`, `updated_at` (timestamps)

Additional tables: `user_messages`, `temporary_chats`, `profile_chats`, `user_devices`, `native_devices`, `native_shop_owners`

---

## 4. FIREBASE AUTHENTICATION

Firebase Authentication handles user login and registration.

### Key Features:
- Email/password authentication
- User session management via Firebase
- Integration with Supabase user profiles (one-way sync)
- Role detection: distinguishes between "regular" users and "shop_owners"

### Auth Context (`AuthContext.tsx`):
- `user`: Firebase User object (uid, email, displayName)
- `userRole`: Determined after login based on Supabase records
- `aggregatedData`: Aggregated user data from multiple sources
- Methods:
  - `signIn(email, password, locationData?)`: Login as regular user
  - `signUp(email, password, locationData?)`: Register as customer
  - `signInAsShopOwner(email, password, shopId, locationData?)`: Login to existing shop
  - `signUpAsShopOwner(email, password, shopName, shopCategory, locationData?)`: Register new shop
  - `signOut()`: Logout

### Supabase User Device Authentication:
For native apps without traditional Firebase support, there's an alternative system in `supabase-user-devices.ts` that creates device-specific credentials (email and password pairs).

---

## 5. ONESIGNAL NOTIFICATION SYSTEM

OneSignal is the primary push notification service used throughout the app.

### Initialization:
- OneSignal Context Provider initializes the SDK during app startup
- For web: SDK loaded from CDN (https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js)
- For native (Capacitor): Native SDK initialized via MainActivity.java
- Must call `setOneSignalUserIdTag(userId)` after user login to associate notifications with user

### Core Functions in `onesignal-messaging.ts`:

#### `initializeOneSignal()`
- Loads OneSignal SDK for web
- Skipped on Capacitor (native) apps
- Handles both v6+ and legacy APIs

#### `setOneSignalUserIdTag(userId)`
- Tags user with their Firebase UID as `external_user_id`
- Critical for targeting notifications to specific users
- Called after Firebase login/signup
- Handles both web and native environments

#### `sendNotificationByUserId(userIds, payload)`
- Sends notification to specific users by their IDs
- Calls Supabase Edge Function: `send-notification-by-userid`
- Payload includes: title, body, imageUrl, data object

#### `sendNotificationToPlayerIds(playerIds, payload)`
- Sends to OneSignal player IDs (device IDs)
- Used for native device notifications

#### `setupReminderNotificationHandler(callback)`
- Sets up listener for booking reminder notifications
- Triggers callback when reminder is received

### Notification Types:

1. **Booking Confirmation** (sent when customer books)
   - To customer: "✅ Booking Confirmed! Your appointment is booked for [time]. Token #[number]"
   - To shop owner: "📅 New Booking! [customer] booked [service] at [time]. Token #[number]"

2. **Booking Reminders** (before appointment time)
   - Customizable reminder intervals
   - Shows alarm dialog with yes/no options

3. **Campaign Notifications** (shop owner broadcasts)
   - Custom title, message, image
   - Geographically targeted by country/state/district/village

4. **Order Updates**
   - When order status changes (accepted, rejected, ready)
   - Notifications to both customer and shop owner

5. **Review Replies**
   - Notification when shop owner replies to review

6. **Profile Messages**
   - Direct messages between users

---

## 6. PAGE ROUTING & MAIN PAGES

The app uses React Router v7 for client-side routing. Main route: `/` serves as the app hub.

### Published Website Route:
```
/shop/:shopSlug
```
Renders custom-built shop websites.

### Main Pages (all contained in `/` route via state management):

#### **HomePage** (`HomePage.tsx`)
Customer landing page with shop browsing.
- **Tabs**: Explore, Favourite, Account, Videos
- **Explore Tab**:
  - Category selector dropdown
  - Shop search/filter
  - Shop cards with rating, status, distance
  - Real-time online/offline status
  - Pull-to-refresh functionality
  - Swipe navigation between tabs
  - Geolocation-based distance calculation
- **Favourite Tab**:
  - Favorite shops list
  - Toggle favorite status
- **Account Tab**:
  - Current user's profile info
- **Videos Tab**:
  - User-generated short videos feed
- **Features**:
  - World chat modal access
  - Profile view (self or others)
  - Shop detail navigation
  - Video page navigation

#### **ShopDetailsPage** (`ShopDetailsPage.tsx`)
Detailed shop information and booking interface.
- Shop images (main image, location image)
- Interior video (if available)
- Shop info: name, owner, phone, about, hours
- Services list with prices
- Staff members with profiles
- Reviews section with star ratings
- Booking button (opens BookingModalNew)
- Time slot availability view
- Favorite toggle
- Share functionality
- Review submission form

#### **BookingModalNew** (`BookingModalNew.tsx`)
Multi-step booking workflow:
1. **Service Selection**: Choose service from shop's service list
2. **Time Slot Selection**: Pick available time slot for the day
3. **Reminder Setup**: Set reminder interval (15, 30, 60 minutes before)
4. **Confirmation**: Review booking details
5. **Success**: Booking confirmed with token number

Booking flow:
- Checks if shop is open
- Loads available time slots (checks Supabase for conflicts)
- Generates next token number
- Creates booking in Supabase
- Triggers notifications to customer and shop owner
- Sets device alarm reminder
- Adds to local booking history

#### **ProfilePage** (`ProfilePage.tsx`)
User profile and activity page.
- **Tabs**: Today, History, Posts, Campaigns, Orders
- **Today Tab**:
  - Current user's upcoming bookings
  - Edit profile info (name, phone, photo)
  - Location management (address, GPS coords)
  - Device password setup
  - Profile completion checklist
- **History Tab**:
  - Past bookings
  - Ability to re-book
  - Delete old bookings
  - Booking timeline view
- **Posts Tab**:
  - User's uploaded videos
  - Like/unlike functionality
  - Video management
- **Campaigns Tab**:
  - For shop owners: campaign history and creation
  - Campaign performance analytics
- **Orders Tab**:
  - Customer's orders from shops
  - Order status tracking
  - Collection confirmation

#### **BarberPortal** (`BarberPortal.tsx`)
Shop owner dashboard for managing their business.
- **Password Protection**: Shop owner enters shop password to access
- **Tabs**: Dashboard, Bookings, Settings, Campaigns, Customization, Uploads, Preview, Website, Khata Book, Orders

Tab breakdown:

1. **Dashboard Tab**:
   - Shop status toggle (open/closed)
   - Pause bookings toggle
   - Quick stats (today's bookings, pending orders)
   - Online/offline status
   - Last ping time display

2. **Bookings Tab**:
   - Today's incoming booking requests
   - Accept/reject/postpone booking workflow
   - Real-time booking listener
   - Customer details display
   - Negotiations support

3. **Settings Tab**:
   - Shop name, location, contact info
   - Opening/closing times
   - Business location (address, GPS)
   - Service management (add/edit/delete)
   - Staff member management (add/edit/delete barbers)
   - Password management
   - Category assignment
   - Website builder toggle
   - Token booking enable/disable

4. **Campaigns Tab**:
   - Campaign builder (create new)
   - Campaign history (view sent campaigns)
   - Targeting selection (country/state/district/village)
   - Schedule campaigns for future delivery
   - Image upload for campaigns
   - Plan restrictions (Pro plan only allows shop-level targeting)

5. **Customization Tab**:
   - Shop image upload
   - Shop interior video upload
   - Location image upload
   - Shop description editing
   - Featured products management
   - Shop offers management

6. **Uploads Tab**:
   - Video recorder integration
   - Upload personal/promotional videos
   - Video listing and management

7. **Preview Tab**:
   - Preview shop listing as customers see it

8. **Website Tab**:
   - Website builder interface
   - Drag-and-drop components
   - Publish to custom domain
   - Analytics (view count, visitor stats)

9. **Khata Book Tab**:
   - Customer payment tracking
   - Credit/debit ledger
   - Payment history

10. **Orders Tab**:
    - Incoming customer orders
    - Accept/reject workflow
    - Order status management (ready for collection, collected)

#### **StaffPortal** (`StaffPortal.tsx`)
Admin panel for app staff (not shop owners).
- **Tabs**: Manage, Ordering, Inbox, Updates

1. **Manage Tab**:
   - List all shops
   - Add new shops
   - Delete shops
   - Reorder shops (pin/unpin for featured)
   - Toggle shop open/closed status

2. **Ordering Tab**:
   - Set shop display order
   - Pin shops for top visibility

3. **Inbox Tab**:
   - Messages from users
   - Reply to messages
   - Message management

4. **Updates Tab**:
   - App update version management
   - Upload APK files
   - Update messaging

#### **ShortVideosPage** (`ShortVideosPage.tsx`)
TikTok-style short video feed.
- Vertical scrolling video feed
- Like/unlike videos
- User profile links
- Video metadata (uploader, caption, duration)
- Comments/engagement features

#### **CategoryShopsPage** (`CategoryShopsPage.tsx`)
Browse shops by category.
- Category selection
- Filtered shop listing
- Navigate to shop details

#### **PublishedWebsite** (`PublishedWebsite.tsx`)
Renders custom shop websites built with WebsiteBuilder.
- Loads website by shop slug from URL: `/shop/:shopSlug`
- Renders custom components (text, images, buttons, etc.)
- Displays shop reviews section
- Increments view counter
- Full customization from WebsiteBuilder

---

## 7. KEY COMPONENTS & FEATURES

### Booking System

The booking system is two-fold:

1. **Simple Token Booking** (`BookingModalNew.tsx`):
   - Customer selects service and time slot
   - Receives token number
   - Gets reminder notification before appointment
   - Basic workflow

2. **Advanced Booking with Negotiation** (ProductionBooking components):
   - `CustomerTimeSlotSelection.tsx`: Customer proposes time slots
   - `CustomerOfferResponse.tsx`: Customer responds to shop owner's counter-offers
   - `OwnerOfferTimeSelection.tsx`: Shop owner makes counter-offers
   - `OwnerBookingNotification.tsx`: Shop owner receives booking request
   - `OwnerNotRespondingPopup.tsx`: Timeout handling if owner doesn't respond
   - Real-time negotiation via Supabase subscriptions
   - Booking completion with customer confirmation

### Reminder & Alarm System

The app has a sophisticated reminder system for booking confirmations:

1. **Local Reminders** (`local-reminders.ts`):
   - In-memory reminder storage
   - Reminder objects: id, userId, bookingId, reminderTime, etc.

2. **Device Alarms** (Android):
   - `alarm-scheduler.ts`: Schedules native Android alarms
   - `AlarmReceiver.java`: Broadcast receiver for alarm triggers
   - Alarms persist even when app is closed
   - Opens app and shows reminder dialog when triggered
   - Support for shop owner alarms (confirm customer is coming)
   - Support for customer alarms (customer coming to shop)

3. **Notification-based Reminders**:
   - OneSignal scheduled notifications
   - `setupReminderNotificationHandler()`: Listens for reminder notifications
   - `ReminderAlarmContext.tsx`: Manages active reminder state
   - `ReminderToast.tsx`: Toast UI for reminder dialogs

### Videos System

Short-form video content (max 60 seconds):
- `ShortVideosPage.tsx`: Vertical feed UI
- `VideoRecorder.tsx`: Camera recording interface
- `VideoUploadModal.tsx`: Video upload to Supabase Storage
- `supabase-videos.ts`: Video database operations
- Like/unlike functionality
- User profile links from videos
- Caption and metadata support

### Reviews System

Customer reviews for shops:
- `ReviewsList.tsx`: Display reviews with star ratings
- `ReviewForm.tsx`: Submit new review with image
- `ReviewReplyForm.tsx`: Shop owner replies to reviews
- Star rating (1-5)
- Image upload with reviews
- Verified customer badge
- Helpful count

### Website Builder System

Drag-and-drop website builder for shops:
- `WebsiteBuilder.tsx`: Main builder interface
- `PublishedWebsite.tsx`: Render published websites
- Components available:
  - **Text**: Editable text with font styling
  - **Image**: Images with sizing
  - **Button**: Clickable buttons
  - **Divider**: Spacing/separator
  - **Heading**: Section headings
  - **Advanced Components**: Reviews carousel, products gallery, map, contact form, booking button
- Styling: Colors, sizing, alignment, borders, shadows
- Save as draft or publish
- Custom domain support (Vercel integration)
- View count analytics
- Plan restrictions (Pro plan only)

### Campaigns System

Marketing broadcast system:
- `CampaignBuilder.tsx`: Create campaigns
- `CampaignTargetSelector.tsx`: Geographic targeting
- `ScheduleSelector.tsx`: Schedule delivery time
- `CampaignHistory.tsx`: View sent campaigns
- `CampaignAnalytics.tsx`: Campaign performance
- Targeting levels: country, state, district, village
- Pro plan restrictions: locked to shop location
- Image support
- Scheduled sending

### Chat System

Multiple chat modes:

1. **Profile Chat** (`ProfileChatModal.tsx`):
   - Direct 1-on-1 messaging
   - User profile links
   - Message history

2. **Temporary Chat** (`TemporaryChatSection.tsx`):
   - Short-term conversations
   - Auto-expiring messages

3. **World Chat** (`WorldChatModal.tsx`):
   - Global chat for all users
   - Public messages
   - Auto-expires after set time
   - Image support in messages

### Orders System

For shops selling products/services with payment:
- `CustomerOrdersPanel.tsx`: Customer places orders
- `OrderRequestsPanel.tsx`: Shop owner receives and responds to orders
- Order lifecycle:
  1. Pending: Customer creates order
  2. Accepted/Rejected: Shop owner responds
  3. Ready for Collection: Shop prepares item
  4. Collected: Customer picks up
- Status updates with notifications
- Payment integration (Razorpay)
- Expiration handling

### Payment Integration

Razorpay is integrated for payments (not fully explored in code):
- Import available: `import razorpay from 'razorpay'`
- Used for plan subscriptions and potentially orders

---

## 8. NOTIFICATION FLOW IN DETAIL

### Booking Created → Notifications Sent

1. Customer completes booking in `BookingModalNew.tsx`
2. `addBookingToSupabase()` is called from `supabase-bookings.ts`
3. This function automatically calls `sendBookingNotifications(booking)`
4. `sendBookingNotifications()` in `booking-notification-system.ts`:
   - Gets shop owner's user ID from `getNativeShopOwnersByShopId()`
   - Sends 2 notifications in parallel:
     - **Customer Notification**: "✅ Booking Confirmed! Your appointment is booked for [time]. Token #[number]"
     - **Shop Owner Notification**: "📅 New Booking! [customer] booked [service] at [time]. Token #[number]"
   - Uses `sendNotificationByUserId()` which calls Supabase Edge Function `send-notification-by-userid`
5. Notifications appear as push notifications on customer/owner devices
6. If customer set reminder, device alarm is scheduled via `startForegroundAlarmService()`

### Reminder Notification → Alarm Dialog

1. When reminder time is reached:
   - **Web**: OneSignal notification shows
   - **Native**: Device alarm triggers via AlarmReceiver
2. App receives notification via `setupReminderNotificationHandler()`
3. Callback triggers `setActiveReminder()` in `ReminderAlarmContext`
4. `ReminderToast.tsx` displays modal with:
   - Booking details
   - "Yes, I'm coming" button
   - "Cancel booking" button
5. If "Yes":
   - Notifies shop owner that customer is coming
   - Cancels device alarm
   - Deletes local reminder
6. If "No":
   - Deletes booking from Supabase
   - Notifies customer of cancellation
   - Cancels device alarm

### Campaign Sent → Geo-Targeted Notifications

1. Shop owner creates campaign with targeting in `CampaignBuilder.tsx`
2. Campaign stored in `campaigns` table
3. When sent (or scheduled):
   - Calls `sendCampaignDirectly()` from `campaign-sender.ts`
   - Queries user profiles matching target location
   - Sends OneSignal notification to each matching user
   - Notification includes: title, message, image, campaign data

### Order Created → Notifications

1. Customer creates order in `CustomerOrdersPanel.tsx`
2. `createOrder()` called from `supabase-orders.ts`
3. Calls Supabase Edge Function `create-customer-order`
4. Function returns order object
5. Notifications sent:
   - Shop owner receives: "New Order: [customer] ordered [amount]"
   - Customer receives order confirmation
6. When shop owner accepts/rejects:
   - `sendOrderNotificationToUser()` notifies customer of status
   - Updates order status in database

---

## 9. KEY UTILITIES & HELPERS

### Geolocation (`geolocation.ts`)
- `fetchUserLocation()`: Get device GPS coordinates
- `calculateDistance()`: Calculate distance between two coordinates
- Used for distance display on shop cards

### Time Slots (`time-slot-utils.ts`)
- Time slot management (15-minute, 30-minute, 45-minute intervals)
- Availability checking
- IST timezone handling

### Shop Ordering (`shop-ordering.ts`)
- `getOrderedShops()`: Sort shops by:
  - Pinned status first
  - Online status
  - Last ping time (recent activity)
  - Distance (if location available)

### Retry Utils (`retry-utils.ts`)
- `retryWithBackoff()`: Exponential backoff retry logic
- Used for Supabase queries to handle transient failures

### Favorite Shops (`favorite-shops-storage.ts`)
- `getFavoriteShops()`: Retrieve user's favorite shops
- `toggleFavoriteShop()`: Add/remove favorites
- Persisted in browser storage

### Booking History (`booking-history.ts`)
- `getBookingHistory()`: Retrieve user's past bookings
- `deleteBooking()`: Remove booking from history
- Separate from Supabase bookings table

### Device Management (`supabase-user-devices.ts`)
- For non-Firebase auth users (native apps without Firebase)
- Creates device-specific email/password credentials
- Used as fallback authentication method

---

## 10. CONTEXT PROVIDERS

### AuthContext
- Provides: `user`, `userRole`, `loading`, `aggregatedData`
- Methods: `signIn`, `signUp`, `signInAsShopOwner`, `signUpAsShopOwner`, `signOut`
- Integrates with Firebase and Supabase

### UserProfileContext
- Provides: `profile` (current user's profile)
- Methods: `saveProfile`, `updateProfile`
- Fetches from `user_profiles` table

### OneSignalContext
- Provides: `isInitialized`, `isInitializing`, `error`
- Initializes OneSignal SDK during app startup
- Shows splash screen while initializing

### ReminderAlarmContext
- Provides: `activeReminder`, `setActiveReminder`
- Manages the current active reminder popup state

### BookingNegotiationContext
- Manages real-time booking negotiation state
- Tracks offers and counter-offers

### AppUpdateContext
- Manages app version updates
- Triggers update notification prompts

---

## 11. SPECIAL FEATURES

### Shop Online Status System
- `startShopHeartbeat()`: Periodic ping to Supabase updating `last_ping_time`
- `sendImmediateOnlineUpdate()`: Immediate status update when app resumes
- Display status calculated from `last_ping_time`:
  - Online: pinged within last 2 minutes
  - Recently Online: pinged within last 15 minutes
  - Offline: no recent ping

### Website Components
Drag-and-drop components for website builder:
```typescript
type WebsiteComponent = {
  type: 'text' | 'image' | 'button' | 'divider' | 'heading' | 'reviews' | 'products' | 'map' | 'contact' | 'booking'
  content: string
  styles: {
    fontSize?: number
    color?: string
    backgroundColor?: string
    alignment?: 'left' | 'center' | 'right'
    width?: string | number
    height?: string | number
    borderRadius?: number
    padding?: number
    ...
  }
}
```

### Plan System (`supabase-shop-owner-plans.ts`)
Shop owner subscription plans:
- **Basic**: Free tier
- **Pro**: Campaign restrictions (geo-targeting limited to shop location)
- **Enterprise**: Full features

Plan restrictions affect:
- Campaign targeting scope
- Website builder features
- Additional features

### App Lifecycle Management (`app-lifecycle.ts`)
- Detects app state changes: paused, resumed, stopped
- Used for immediate status updates when app resumes
- Handles back button presses (exit on double-back)

### 3D Components
- `Tab3D.tsx`: 3D tab switcher using React Three Fiber
- `AnimatedCreature.tsx`: Animated 3D character

### Error Boundary
- Global error boundary for crash prevention
- Graceful error UI display

---

## 12. DEVELOPMENT & BUILD SCRIPTS

### Available Scripts:
- `npm run dev`: Start Vite dev server (http://localhost:5173)
- `npm run build`: Build production bundle (increments version, syncs versions)
- `npm run lint`: Run all linters (types, JS, CSS, variables)
- `npm run preview`: Preview production build locally
- `npm run lint:types`: TypeScript type check
- `npm run lint:js`: ESLint check
- `npm run lint:css`: Stylelint check

### Environment Variables Needed:
```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_FIREBASE_API_KEY=<firebase-key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
VITE_FIREBASE_PROJECT_ID=<firebase-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<firebase-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<firebase-sender-id>
VITE_FIREBASE_APP_ID=<firebase-app-id>
```

### Build Configuration:
- Vite for bundling and dev server
- TypeScript strict mode enabled
- Tailwind CSS for styling
- PostCSS for CSS processing
- ESLint for code quality
- Stylelint for CSS quality

---

## 13. NATIVE MOBILE CONSIDERATIONS

### Capacitor Integration
- Cordova/Capacitor for cross-platform (Android/iOS)
- Native plugins:
  - `@capacitor/geolocation`: GPS access
  - `@capacitor/local-notifications`: Device alarms
  - `@capacitor/dialog`: Native dialogs
  - `@capacitor/app`: App lifecycle
  - `@capacitor-firebase/messaging`: Push notifications
  - OneSignal Cordova plugin

### Native Features:
- Push notifications via OneSignal + Firebase
- Device alarms that persist when app closed
- GPS location services
- Local notifications
- App lifecycle handling
- Back button handling (custom on Android)

### Build for Native:
- Same React codebase serves web and native
- Conditional initialization based on `Capacitor.isNativePlatform()`
- Android builds use APK uploads to StaffPortal

---

## 14. EXTERNAL INTEGRATIONS

### Services Integrated:
1. **Supabase**: Backend database, storage, auth fallback, Edge Functions
2. **Firebase**: Email/password authentication, Cloud Messaging
3. **OneSignal**: Push notifications (primary)
4. **Razorpay**: Payment processing
5. **Google Maps**: Location links and mapping
6. **Vercel**: Website hosting (for published shop sites)

### APIs Used:
- Supabase REST API
- Firebase Auth REST API
- OneSignal REST API
- Supabase Edge Functions (custom serverless functions)

---

## 15. STATE MANAGEMENT ARCHITECTURE

The app uses **React Context API** for state management (no Redux/Zustand):

- **AuthContext**: Global auth state and methods
- **UserProfileContext**: Current user profile
- **OneSignalContext**: Notification initialization state
- **ReminderAlarmContext**: Active reminder state
- **Local State**: useState for component-level state
- **Supabase Subscriptions**: Real-time listeners for bookings, chats, orders
- **Browser Storage**: localStorage for favorites, bookings, settings

---

## 16. STYLING & DESIGN SYSTEM

### CSS Framework:
- **Tailwind CSS** v3.3.5 for utility-first CSS
- **Radix UI** for accessible component primitives
- **Tailwind Merge** for dynamic class merging

### Custom Components:
- All UI components in `src/components/ui/`
- Built on Radix UI primitives with Tailwind styling
- Theme-aware with next-themes support

### Animations:
- **Framer Motion** for React animations
- Page transitions
- Component entrance/exit animations
- Gesture-based animations (swipe navigation)

### Responsive Design:
- Mobile-first approach
- Tested on various screen sizes
- Touch-friendly interactions
- Swipe gestures for navigation

---

## 17. KEY WORKFLOWS

### Customer Booking Workflow:
1. Browse HomePage → Select Category → View Shops
2. Click Shop → ShopDetailsPage opens
3. Click "Book Now" → BookingModalNew opens
4. Select Service → Select Time Slot → Set Reminder
5. Confirm Booking
6. Supabase creates booking record
7. Notifications sent to customer + shop owner
8. Device alarm scheduled for reminder
9. Booking appears in customer ProfilePage (Today tab)
10. Booking appears in shop owner BarberPortal (Bookings tab)
11. At reminder time: Popup shows, customer confirms or cancels

### Shop Owner Setup Workflow:
1. Sign up as shop owner via LoginPopup
2. Redirect to BarberPortal with shop creation
3. Enter shop details (name, location, hours, services, staff)
4. Shop created in Supabase
5. Set password for portal access
6. Configure bookings, campaigns, website
7. Go live - customers can book

### Campaign Sending Workflow:
1. Navigate to BarberPortal → Campaigns tab
2. Click "Create Campaign"
3. Fill campaign details (title, message, image)
4. Select targeting (country/state/district/village)
5. Schedule delivery or send immediately
6. Campaign saved to Supabase
7. Background job sends notifications to targeted users
8. Campaign history shows delivery status

### Website Publishing Workflow:
1. Navigate to BarberPortal → Website tab
2. Click "Open Website Builder"
3. Drag-drop components (text, images, buttons, reviews, products)
4. Customize styles (colors, sizes, alignment)
5. Preview website
6. Click "Publish"
7. Supabase stores website data
8. Website accessible at `/shop/:shop-slug`
9. Custom domain can be configured

---

## 18. PERFORMANCE OPTIMIZATIONS

- **Code Splitting**: Route-based splitting with React Router
- **Image Optimization**: Responsive images, lazy loading
- **Caching**: Browser cache for images, videos
- **Supabase Subscriptions**: Real-time updates instead of polling
- **Local State**: Minimize re-renders with proper Context design
- **Workbox**: PWA support with service worker caching

---

## 19. SECURITY CONSIDERATIONS

- **Firebase Auth**: Industry-standard authentication
- **Supabase RLS**: Row-level security policies on database
- **Environment Variables**: Sensitive keys not hardcoded
- **HTTPS**: All external APIs use HTTPS
- **Input Validation**: Zod schemas for form validation
- **OneSignal Tags**: External user IDs to prevent cross-user notifications

---

## 20. ERROR HANDLING & LOGGING

- **Global Error Boundary**: `ErrorBoundary.tsx` catches rendering errors
- **Try-Catch**: Extensive try-catch in async operations
- **Logging**: Console logs with emoji prefixes for easier debugging
- **Toast Notifications**: User-facing errors via react-hot-toast
- **Graceful Degradation**: App continues if non-critical operations fail

---

## SUMMARY

This is a comprehensive, production-grade service booking platform with:
- **Dual User Types**: Customers and Shop Owners
- **Real-Time Features**: Live bookings, notifications, chat
- **Mobile Support**: Native Android/iOS via Capacitor
- **Commerce Features**: Orders, payments, featured products, offers
- **Content System**: Short videos, reviews, custom websites
- **Marketing Tools**: Campaigns, analytics, promotions
- **Subscription Model**: Tiered plans (Basic/Pro/Enterprise)
- **Geo-Targeting**: Location-based features and filtering
- **Native Integrations**: OneSignal, Firebase, Razorpay, Vercel

The codebase is well-organized, type-safe, and follows React best practices. Rebuilding this app requires careful attention to Supabase schema, Firebase auth flow, OneSignal integration, and Capacitor native layer.
