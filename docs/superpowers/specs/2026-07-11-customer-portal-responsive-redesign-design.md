# Customer Portal Responsive Redesign — Design Spec

## Goal

Upgrade the Customer Portal (Landing, Menu, Cart, Checkout, Profile, and Loyalty pages) to adapt seamlessly between mobile and PC/desktop screen sizes. Establish a modern, premium responsive layout that makes full use of wider desktop monitors while maintaining a polished, app-like experience on mobile.

## Proposed Layout Changes

### 1. Navigation Shell (`BottomNav` & `CustomerHeader`)

- **Current State:** The customer navigation relies on a bottom tab bar (`BottomNav`) that stretches full width on all screens, and a very minimal top header (`CustomerHeader`) showing only the brand name and a back button.
- **Redesign:**
  - Convert [CustomerHeader](file:///c:/Users/dotha/OneDrive/Desktop/CoffeeShop/components/customer/header.tsx) to a Client Component.
  - On desktop screens (`md` breakpoint, `>= 768px`), display a full horizontal navigation menu in the header (Menu, Cart with item badge count, Orders, Loyalty, Profile).
  - Hide the bottom tab bar [BottomNav](file:///c:/Users/dotha/OneDrive/Desktop/CoffeeShop/components/customer/bottom-nav.tsx) on desktop using the Tailwind class `md:hidden`.
  - Add an active link indicator line below the current active route in the desktop header.

### 2. Responsive Menu Browser (`MenuBrowser`)

- **Current State:** Displays items in a single-column list restricted to `max-w-2xl` on all screen sizes, leading to empty space on desktop screens.
- **Redesign:**
  - Expand the main container of [MenuBrowser](file:///c:/Users/dotha/OneDrive/Desktop/CoffeeShop/components/customer/menu-browser.tsx) to `max-w-7xl` on desktop.
  - On mobile, keep the single-column list view for compact touch interaction.
  - On desktop (`md` breakpoint), switch to a multi-column responsive grid layout: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6`.
  - Style menu items as cards: image on top (aspect-video crop), item name, description in the middle, and price + circular quick-add `+` button at the bottom.

### 3. Cart & Checkout Pages (`CartView` & `CheckoutView`)

- **Current State:** Displays cart rows, inputs, and totals in a single-column flow restricted to `max-w-2xl` on all screen sizes.
- **Redesign:**
  - Expand [CartView](file:///c:/Users/dotha/OneDrive/Desktop/CoffeeShop/components/customer/cart-view.tsx) and [CheckoutView](file:///c:/Users/dotha/OneDrive/Desktop/CoffeeShop/components/customer/checkout-view.tsx) containers to `max-w-6xl` or `max-w-7xl`.
  - Implement a split 2-column layout on desktop:
    - **Left Column (60-65% width):** Cart items list (with quantity controls) or checkout details form (order type, table selection, notes, payment methods).
    - **Right Column (35-40% width):** A sticky container containing the order summary block (subtotal, applied discounts, tax rate, total, rewards list) and the checkout/payment trigger button.

### 4. Profile & Loyalty Pages (`ProfileView` & `LoyaltyView`)

- **Current State:** Stretched single-column layouts.
- **Redesign:**
  - Expand [ProfileView](file:///c:/Users/dotha/OneDrive/Desktop/CoffeeShop/components/customer/profile-view.tsx) and [LoyaltyView](file:///c:/Users/dotha/OneDrive/Desktop/CoffeeShop/components/customer/loyalty-view.tsx) to `max-w-5xl`.
  - On desktop, use a 2-column split layout:
    - **Profile:** Left side handles user details (avatar, member ID card, editable info fields). Right side handles options (Settings, Addresses, Language Switcher, Log out) in a card layout.
    - **Loyalty:** Left side houses current balance, tier progress progress-ring, and reward catalog redemption card. Right side houses the transaction history lists.

### 5. Order History & Order Tracking (`OrderHistory` & `OrderTracking`)

- **Current State:** Stretched single-column layouts.
- **Redesign:**
  - Expand [OrderHistory](file:///c:/Users/dotha/OneDrive/Desktop/CoffeeShop/components/customer/order-history.tsx) and [OrderTracking](file:///c:/Users/dotha/OneDrive/Desktop/CoffeeShop/components/customer/order-tracking.tsx) layouts to `max-w-5xl`.
  - **Order History:** On desktop, render orders with a cleaner grid or clear rows, highlighting date, items, total price, and status badge side-by-side.
  - **Order Tracking:** On desktop, split into a 2-column layout with status steps and order details on the left, and payment methods/summary on the right.

## Verification Plan

### Automated Verification
- Verify the build passes cleanly: `npm run build`
- Ensure no TypeScript compile errors.

### Manual Verification
- Resize the browser window between mobile sizes (< 768px) and desktop sizes (>= 1024px) to ensure layout shifts are smooth and without collisions.
- Check headers: Verify header navbar items appear on desktop, and bottom tab bar hides. Verify the opposite on mobile.
- Verify menu: Grid view shows 3-4 columns on desktop, list view on mobile.
- Verify checkout and cart: Split view renders correctly on desktop, sticky summary card stays in view, stacked layout renders on mobile.
- Verify that language switches work correctly on both mobile and desktop.
