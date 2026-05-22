Roster-Based Shift Checklist System
Feature Requirements for Roster Management App

# 1. Purpose
We need a simple checklist feature inside the roster management and clock-in/clock-out system.
The goal is to make sure employees clearly know what tasks they need to complete during their shift, based on:
- Their shift type
- Daily recurring tasks
- Morning, afternoon, closing, delivery, ordering, and manager responsibilities
- Any one-off tasks added by the manager
The feature must be fast and easy for staff to use, while still giving managers visibility over incomplete tasks.
# 2. Main Concept
The system should support reusable checklist templates. Managers can create multiple checklist templates and attach one or more templates to each rostered shift.

When a rostered shift is created, the system should automatically copy the tasks from the assigned templates into that specific rostered shift.
# 3. Shift Types
Shift types should be configurable by an admin or manager.

# 4. Checklist Templates
Managers should be able to create reusable checklist templates. Each template should have:

## Example Templates

# 5. Tasks Inside a Template

Photo uploads should be optional or future phase only. Do not make every task require evidence, because staff will find it annoying and may fake-complete tasks.
# 6. Default Templates by Shift Type
Managers should be able to assign one or more default checklist templates to each shift type.

# 7. Roster Creation Logic
When a rostered shift is created, the system should:
1. Identify the shift type.
1. Find the default checklist templates assigned to that shift type.
1. Copy all active tasks from those templates into that specific rostered shift.
1. Save the copied tasks against that individual rostered shift.
1. Allow the manager to edit the copied tasks before publishing the roster.

# 8. Multiple Checklist Templates on One Shift
The system must allow multiple checklist templates to be added to one rostered shift.

Managers should be able to manually add or remove checklist templates from a specific rostered shift.
# 9. Roster-Level Task Editing
Once tasks are copied into a rostered shift, they become shift-specific tasks.
Managers should be able to:
- Add extra one-off tasks
- Remove tasks
- Edit task wording
- Change task instructions
- Mark a task as required or optional
- Reorder tasks
- Add or remove checklist templates for that shift
Important rule: Editing tasks inside a rostered shift should only affect that specific shift. It should not change the original checklist template or other rostered shifts.
# 10. Template Update Rule
If the manager updates a default checklist template later, existing rostered shifts should not automatically change.
Reason: once a roster is created, the tasks are copied and saved separately.
Optional future feature: add a Refresh/Reapply Template button if the manager wants to update an already-created rostered shift with the latest template.
# 11. Employee Clock-In Flow
When an employee clocks in:
1. Employee enters ID or uses the existing clock-in process.
1. System identifies their rostered shift.
1. System loads the copied task list attached to that shift.
1. Employee sees the task checklist for the shift.
Example message: You are clocked in for Morning Shift. You have 8 tasks assigned for this shift.

# 12. Employee Task Completion
Employees should be able to mark each task as:

If the employee selects Not Done for a required task, they must enter a reason.

# 13. Clock-Out Flow
Before the employee clocks out, the system should check required tasks.
- If all required tasks are completed, the employee can clock out normally.
- If required tasks are incomplete, the system should ask the employee to complete the task or provide a reason.
- Do not fully block clock-out. The employee should still be allowed to clock out after providing a reason for incomplete required tasks.
Reason: blocking clock-out can create operational and payroll issues.
# 14. Manager Dashboard
Managers should be able to view task completion by date, employee, shift type, checklist template, and task status.

Managers should be able to filter by date, employee, shift type, status, and incomplete tasks.
# 15. Notifications
For MVP, the checklist should be shown inside the app after clock-in. Email notification is optional.

Do not rely only on email because staff may not check email during a shift.
# 16. Basic Data Structure
## A. Shift Type

## B. Checklist Template

## C. Checklist Template Task

## D. Shift Type Template Mapping

## E. Rostered Shift

## F. Rostered Shift Task

# 17. Acceptance Criteria
## Template Setup
- Manager can create checklist templates.
- Manager can add multiple tasks inside each template.
- Manager can mark each task as required or optional.
- Manager can activate or deactivate templates.
- Manager can activate or deactivate individual tasks.
## Shift Type Mapping
- Manager can create or manage shift types.
- Manager can assign one or more default checklist templates to each shift type.
- The same template can be used across multiple shift types.
## Roster Creation
- When a rostered shift is created, the system automatically copies tasks from the default templates assigned to that shift type.
- Multiple checklist templates can be copied into one rostered shift.
- Copied tasks are saved against that specific rostered shift.
- If the default template changes later, existing rostered shifts do not automatically change.
## Roster-Level Editing
- Manager can edit copied tasks inside a specific rostered shift.
- Manager can add one-off tasks to a specific rostered shift.
- Manager can remove copied tasks from a specific rostered shift.
- Manager can manually add or remove checklist templates from a specific rostered shift.
- Roster-level changes do not update the original checklist template.
- Roster-level changes do not affect other rostered shifts.
## Employee Flow
- Employee sees the assigned checklist after clocking in.
- Employee can mark each task as Done, Not Done, or Not Applicable.
- If a required task is marked Not Done, employee must enter a reason.
- Before clock-out, the system checks if required tasks are incomplete.
- Employee can clock out after completing tasks or providing reasons for incomplete required tasks.
- The system should not fully block clock-out.
## Manager Review
- Manager can view task completion by employee, date, shift type, and task status.
- Manager can see incomplete tasks and reasons.
- Manager can filter task records.
- Manager can review shift checklist history.
# 18. MVP Scope

# 19. Simple Developer Summary
Build a roster-based checklist system.
- Managers can create reusable checklist templates such as Daily, Morning, Afternoon, Delivery, Ordering, Closing, and Manager checklists.
- Each shift type can have one or more default checklist templates assigned to it.
- When a rostered shift is created, the system automatically copies all tasks from the default templates into that specific shift.
- Managers can manually add or remove templates and edit tasks directly inside the rostered shift.
- Once copied, tasks become shift-specific and editing them should not affect the original template or other shifts.
- When employees clock in, they see the copied task list for their shift.
- Before clocking out, employees must mark required tasks as Done, Not Done, or Not Applicable. If required tasks are not completed, they must provide a reason.
- Managers can review task completion, incomplete tasks, and reasons in a dashboard.