Product Order Guide / Category-Based Ordering
Developer Requirements Document

For IGA roster, task checklist, and ordering workflow


## 1. Purpose
We need to add a Product Order Guide module to the roster/task checklist system. The module should allow managers to maintain products that need to be ordered regularly, grouped by product category, and guide staff on what to order, how much to order, when to order, and how to order.
The system should reduce missed orders and reduce confusion, while keeping supplier credentials secure.
## 2. Main Concept
The ordering module should work as a category-based order guide. Staff should not see one large product list. They should first choose an order category, then view only the products relevant to that category.

## 3. Business Rule: Do Not Manually Manage Everything at First
For categories with a small number of products, such as fruit & veg, dairy, bread, ready meals, and juice, a manual order guide is practical because each category may only have around 20-30 key products.
For grocery and liquor, do not try to maintain every product manually in the first version. This will create too much admin work and will likely fail operationally.
Start grocery and liquor with key items only.
Include fast-moving, frequently missed, high-margin, promotional, or commonly requested products.
Expand later only if POS or supplier ordering integration becomes available.
## 4. Product Categories
Managers should be able to create and maintain product/order categories. Each product must belong to one category.

## 5. Product Order Guide
Managers should be able to create and maintain product records inside each category.

## 6. Min / Max Ordering Logic
The system should support simple min/max ordering logic for products where current stock can be checked easily.

Suggested order quantity formula:
Suggested Order Qty = Maximum Stock Qty - Current Stock Qty
Ordering should be recommended only when:
Current Stock Qty <= Minimum Stock Qty

## 7. Today's Orders Screen
The ordering screen should show categories first. This keeps the process simple for staff and prevents them from scrolling through a large product list.

When staff open a category, they should see only that category's products.

## 8. Employee Ordering Flow
Employee opens Today's Orders.
System shows order categories first.
Employee selects a category, such as Fruit & Veg or Dairy & Milk.
Employee checks current stock and enters current stock quantity or selects a simple stock status.
System calculates suggested order quantity if min/max values are available.
Employee confirms or edits final order quantity.
Employee follows the ordering instruction shown by the system.
Employee marks each item as Ordered, Not Required, or Issue.
If Issue is selected, employee must enter a reason.
System saves order completion status, final quantity, employee name, and timestamp.
## 9. Order Status Values

## 10. Ordering Method and Credential Security
The app should guide staff on how to order, but it should not show supplier portal passwords to normal staff.

## 11. Permission Rules

## 12. Grocery and Liquor Handling
## 12.1 Grocery
For grocery, use a “Grocery Key Items” category first. Do not attempt to manually maintain all grocery items in MVP.
Fast-moving items
Frequently missed items
Promo products
High-margin products
Products customers often ask for
Items with regular stock gaps
## 12.2 Liquor
Liquor should be treated separately because supplier process, margin, compliance, and permission requirements are different. Use a “Liquor Key Items” category in MVP.
Fast-moving beer cartons
Popular wine labels
RTDs
Spirits with high turnover
Items frequently out of stock
Normal staff should not place liquor orders unless authorised.
## 13. Spreadsheet Import Requirement
The manager already has a spreadsheet with multiple tabs. The system should support importing products from Excel or Google Sheets.
Each tab should be treated as a product category.

Recommended spreadsheet columns:

## 14. Connection to Roster Checklist
The Product Order Guide should connect to the roster checklist feature. If a rostered shift includes an Ordering Checklist, the employee should see a task such as “Complete Today’s Orders”.
Manager creates roster and assigns a shift type or checklist template that includes ordering responsibility.
When roster is published, employee can view the ordering task and the related order guide.
When employee clocks in, the system shows the task notification: “Check today’s tasks”.
Employee opens the task “Complete Today’s Orders”.
System opens Today’s Orders grouped by category.
Employee completes ordering statuses before clock-out.
If ordering task is incomplete, system asks for completion or reason before allowing clock-out.
## 15. Notifications

## 16. Data Structure
## 16.1 Supplier

## 16.2 Product Category

## 16.3 Product Order Guide Item

## 16.4 Daily Order Task

## 17. Acceptance Criteria
## 17.1 Category and Product Setup
Manager can create product categories.
Each product must be assigned to a category.
Each category can have default supplier, ordering method, order days, cut-off time, and responsible role.
Manager can create suppliers and maintain supplier contact details.
Manager can create products in the order guide.
Manager can assign minimum stock quantity, maximum stock quantity, default quantity, unit, supplier, order days, ordering method, and comment.
Manager can activate or deactivate products and categories.
## 17.2 Daily Order List
System can generate today's order list based on category, product order days, and order frequency.
Staff can view Today's Orders grouped by category.
Staff can open a category and view products for that category only.
Staff can enter current stock quantity.
System calculates suggested order quantity using max stock minus current stock.
System recommends ordering only when current stock is equal to or below minimum stock quantity.
Staff can confirm or edit final order quantity.
Staff can mark product order status as Ordered, Not Required, or Issue.
If Issue is selected, staff must enter a reason.
## 17.3 Security and Permissions
Supplier portal passwords must not be shown inside the app.
Portal ordering should instruct staff to use the store computer or authorised login.
Only authorised roles can place or confirm supplier orders.
Normal staff can check stock and suggest quantities but cannot access sensitive supplier credentials.
Liquor ordering should be restricted to authorised users only.
## 17.4 Roster Connection and Notifications
Ordering tasks can be linked to roster checklist templates.
If a shift includes Ordering Checklist, employee should see the ordering task after roster publish.
Employee should see task notification after clock-in: “Check today’s tasks”.
Clicking the ordering task should open Today's Orders grouped by category.
System should remind staff if orders are pending before supplier cut-off time.
If ordering task is incomplete before clock-out, employee must complete it or provide a reason.
Manager can view incomplete or missed orders.
## 17.5 Spreadsheet Import
Manager can import products from Excel or Google Sheets.
Each spreadsheet tab should be imported as a product category.
Imported products should map to standard fields such as product name, min qty, max qty, unit, supplier, order days, method, comment, and active status.
Imported products should remain editable inside the app.
System should show validation errors for missing required fields.
## 18. MVP Scope

## 19. Developer Summary
Build a Product Order Guide module connected to the roster checklist system.
Managers should be able to create suppliers, product categories, and product order guide items. Products should be grouped by categories such as Fruit & Veg, Dairy & Milk, Bread, Ready Meals, Juice, Grocery Key Items, and Liquor Key Items.
The Today's Orders screen should show categories first. Staff should open a category, check current stock, view suggested order quantity, confirm or edit final quantity, and mark each item as Ordered, Not Required, or Issue.
The system should use min/max logic where possible: suggested order quantity equals maximum stock quantity minus current stock quantity. Ordering should only be recommended when current stock is equal to or below minimum stock quantity.
For grocery and liquor, support a key-items-only approach in the MVP rather than manually maintaining every product.
The system should support spreadsheet import where each tab becomes a product category. Supplier portal credentials should not be shown in the app. Portal orders should be completed using the store computer or authorised login.
If a rostered shift includes ordering responsibility, the employee should be able to view the ordering task after roster publish and again after clock-in. The clock-in notification should remind them to check today's tasks. If ordering is incomplete before clock-out, the employee must complete it or provide a reason.

# Tables Extracted from Document


## Table 1

| Document Item | Details |
| --- | --- |
| Feature Name | Product Order Guide / Category-Based Ordering |
| Related Module | Roster-Based Shift Checklist System |
| Primary Users | Owner/Admin, Manager, Senior Staff, Normal Staff |
| Main Goal | Make product ordering easier, safer, and more consistent without sharing supplier portal credentials. |
| MVP Focus | Category-based order guide, min/max quantities, today's order list, order status, and roster checklist connection. |

## Table 2

| Order Category | Example Products | Recommended Approach |
| --- | --- | --- |
| Fruit & Veg | Banana, tomato, potato, lettuce | Manual checklist with min/max quantity |
| Dairy & Milk | Milk, cheese, yoghurt | Manual checklist with min/max quantity |
| Ready Meals | Youfoodz, Muscle Chef | Manual checklist with sales-based suggested quantity |
| Bread | Tip Top, local bread | Manual checklist with daily or supplier-based quantity |
| Juice / Drinks | Juice, iced coffee, soft drinks | Manual checklist or supplier-based |
| Grocery Key Items | Fast-moving packaged grocery items | Key items only at first; do not maintain every item manually |
| Liquor Key Items | Beer cartons, RTDs, wine, spirits | Key items only, separate permission rules |

## Table 3

| Field | Description |
| --- | --- |
| Category ID | Unique identifier |
| Category Name | Example: Fruit & Veg, Dairy & Milk, Bread, Grocery Key Items |
| Default Supplier | Optional default supplier for the category |
| Default Ordering Method | Portal, phone, SMS, email, sales rep, Metcash/ALM system |
| Order Days | Example: Monday, Wednesday, Friday |
| Cut-off Time | Supplier order cut-off time, e.g. before 2:00 PM |
| Responsible Role | Manager, senior staff, ordering staff |
| Active | Yes/No |

## Table 4

| Field | Description |
| --- | --- |
| Product ID | Unique identifier |
| Product Name | Example: Banana, 2L Full Cream Milk, Youfoodz Meal |
| Category | Linked product/order category |
| Supplier | Optional product-level supplier if different from category supplier |
| Minimum Stock Qty | If stock is equal to or below this level, ordering should be recommended |
| Maximum Stock Qty | Target maximum stock level after ordering |
| Default Order Qty | Optional fallback quantity if min/max logic is not used |
| Unit | Each, box, carton, crate, kg, tray, etc. |
| Order Frequency | Daily, weekly, specific days, or manual |
| Order Days | Specific days the item should be checked or ordered |
| Ordering Method | Portal, phone, SMS, email, sales rep, Metcash/ALM system |
| Ordering Instruction | Short instruction explaining how to order |
| Comment | Optional note such as “order more before weekend” |
| Active | Yes/No |

## Table 5

| Field | Meaning |
| --- | --- |
| Minimum Stock Qty | The level where the product should be considered for ordering |
| Maximum Stock Qty | The target stock level after ordering |
| Current Stock Qty | Quantity entered by employee during stock check |
| Suggested Order Qty | Quantity suggested by the system |

## Table 6

| Product | Min | Max | Current Stock | Suggested Order | Status |
| --- | --- | --- | --- | --- | --- |
| Banana | 3 boxes | 8 boxes | 2 boxes | 6 boxes | Order recommended |
| Tomato | 2 boxes | 6 boxes | 4 boxes | 2 boxes | Optional / no urgent order |
| Lettuce | 10 units | 30 units | 8 units | 22 units | Order recommended |

## Table 7

| Category | Example Status |
| --- | --- |
| Fruit & Veg | 6 items to check |
| Dairy & Milk | 8 items to check |
| Bread | 5 items to check |
| Ready Meals | 3 items to check |
| Juice / Drinks | 4 items to check |
| Grocery Key Items | 10 items to check |
| Liquor Key Items | 12 items to check |

## Table 8

| Product | Min | Max | Current | Suggested | Status |
| --- | --- | --- | --- | --- | --- |
| Banana | 3 boxes | 8 boxes | 2 | 6 | Order |
| Tomato | 2 boxes | 6 boxes | 4 | 2 | Optional |
| Lettuce | 10 units | 30 units | 8 | 22 | Order |

## Table 9

| Status | Meaning | Comment Requirement |
| --- | --- | --- |
| Pending | Item has not been checked or ordered yet | No |
| Ordered | Product has been ordered | Optional order reference or final quantity |
| Not Required | No order needed today | Optional |
| Issue | Could not order or there was a supplier/product issue | Reason required |

## Table 10

| Ordering Method | How It Should Work |
| --- | --- |
| Portal | Show portal URL and instruction. Staff should use the store computer or authorised login. Do not show password in the app. |
| Phone Call | Show supplier phone number and a short order script. |
| SMS | Generate a copyable SMS message with product names and quantities. |
| Email | Generate a copyable email body or email draft. |
| Sales Rep | Allow staff to mark rep contacted, waiting for rep, or issue. |
| Metcash/ALM System | Show instruction to use the relevant ordering system, normally from the store computer or authorised account. |

## Table 11

| Role | Permission |
| --- | --- |
| Owner/Admin | Full access to suppliers, products, categories, order rules, quantities, and reports |
| Manager | Create/edit order guide, complete orders, update quantities, review reports |
| Senior Staff | Complete assigned orders and update final quantities if authorised |
| Normal Staff | View assigned ordering tasks, check stock, suggest quantities, but no sensitive supplier credentials |
| Delivery Helper | No supplier/order access unless specifically assigned |

## Table 12

| Spreadsheet Tab | Imported As |
| --- | --- |
| Fruit & Veg | Fruit & Veg category |
| Dairy & Milk | Dairy & Milk category |
| Bread | Bread category |
| Ready Meals | Ready Meals category |
| Juice | Juice / Drinks category |
| Grocery Key Items | Grocery Key Items category |
| Liquor Key Items | Liquor Key Items category |

## Table 13

| Column | Required? | Notes |
| --- | --- | --- |
| Product Name | Yes | Name of the item to order |
| Minimum Stock Qty | Yes | Used for order trigger |
| Maximum Stock Qty | Yes | Used for suggested quantity calculation |
| Default Order Qty | Optional | Fallback order quantity |
| Unit | Yes | Each, box, carton, kg, etc. |
| Supplier | Optional | Can default from category |
| Order Days | Optional | Mon/Tue/Wed etc. |
| Ordering Method | Optional | Portal, phone, SMS, email, rep |
| Comment | Optional | Extra ordering note |
| Active | Optional | Default to active if blank |

## Table 14

| Trigger | Notification / Reminder |
| --- | --- |
| Roster Published | If an employee has an ordering task: “You have an ordering task in your upcoming shift. Please review the order guide.” |
| Clock-In | “Check today’s tasks. You have ordering items to review.” |
| Before Supplier Cut-Off | “Reminder: Some orders are still pending before cut-off time.” |
| Before Clock-Out | “Ordering task is not completed. Please mark Ordered, Not Required, or Issue before clocking out.” |
| Manager Update After Publish | Employee should be able to view updated ordering tasks and receive reminder if needed. |

## Table 15

| Field | Description |
| --- | --- |
| Supplier ID | Unique identifier |
| Supplier Name | Example: Metcash, ALM, bread supplier |
| Contact Person | Supplier rep/contact |
| Phone | Supplier phone number |
| Email | Supplier email |
| Portal URL | Supplier portal link |
| Order Cut-Off Time | Example: before 2:00 PM |
| Delivery Days | Example: Mon/Wed/Fri |
| Ordering Method | Portal, phone, SMS, email, rep |
| Notes | Optional notes |

## Table 16

| Field | Description |
| --- | --- |
| Category ID | Unique identifier |
| Category Name | Fruit & Veg, Dairy & Milk, Bread, etc. |
| Default Supplier ID | Optional supplier linked to category |
| Default Ordering Method | Optional default method |
| Order Days | Category-level order days |
| Cut-Off Time | Category-level cut-off time |
| Responsible Role | Role responsible for ordering |
| Active | Yes/No |

## Table 17

| Field | Description |
| --- | --- |
| Product ID | Unique identifier |
| Product Name | Item name |
| Category ID | Linked category |
| Supplier ID | Optional product-level supplier |
| Minimum Stock Qty | Minimum level |
| Maximum Stock Qty | Maximum target level |
| Default Order Qty | Fallback quantity |
| Unit | Each, carton, crate, kg, etc. |
| Order Frequency | Daily, weekly, specific days, manual |
| Order Days | Specific days |
| Ordering Method | Portal, phone, SMS, email, rep |
| Ordering Instruction | Short instruction |
| Comment | Optional |
| Active | Yes/No |

## Table 18

| Field | Description |
| --- | --- |
| Order Task ID | Unique identifier |
| Date | Order date |
| Category ID | Linked category |
| Product ID | Linked product |
| Supplier ID | Linked supplier |
| Suggested Qty | System-calculated or default quantity |
| Final Qty | Quantity actually ordered |
| Current Stock Qty | Stock entered by employee |
| Stock Status | Enough, Low, Out of Stock, Not Checked |
| Order Status | Pending, Ordered, Not Required, Issue |
| Ordered By | Employee ID |
| Ordered Time | Timestamp |
| Comment / Reason | Required if Issue |
| Order Reference | Optional reference number |

## Table 19

| Feature | MVP? |
| --- | --- |
| Supplier list | Yes |
| Product categories | Yes |
| Product order guide | Yes |
| Minimum and maximum stock quantity | Yes |
| Default order quantity | Yes |
| Order days / frequency | Yes |
| Ordering method | Yes |
| Today's orders grouped by category | Yes |
| Current stock entry | Yes |
| Suggested order quantity | Yes |
| Mark Ordered / Not Required / Issue | Yes |
| Spreadsheet import from multiple tabs | Yes |
| Roster checklist connection | Yes |
| Clock-in task notification | Yes |
| Reminder before supplier cut-off / clock-out | Yes |
| Supplier portal password storage in app | No |
| Automatic supplier ordering integration | No |
| AI order prediction | Later |
| Barcode scanning | Later |
| POS stock integration | Later |