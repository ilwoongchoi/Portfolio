import re
import pandas as pd
from io import StringIO

# The raw MiniZinc output copied from your console
# This section is pre-filled with the 18 solutions you provided.
# If you run the MiniZinc model again, replace the text inside the triple quotes below.
mzn_output = """
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1]);----------
All_Data = array1d(1..55,[20, 1, 10, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1]);----------
==========
"""

def parse_mzn_output(output_string):
    """Parses MiniZinc array output into a list of data rows."""
    
    # Define the 55 variables in the order they appear in the All_Data array
    column_names = [
        "Total_Violations", "Structural_Violations", "User_Violations",
        # Context 1 Variables
        "E1", "L1", "A1", "a1", "C1", "g1", "G1", "N1", "P1", "T1", "U1", "p1",
        "F1", "H1", "D1", "B1", "e1", "O1", "d1", "S1", "s1", "I1",
        # Context 2 Variables
        "E2", "L2", "A2", "a2", "C2", "g2", "G2", "N2", "P2", "T2", "U2", "p2",
        "F2", "H2", "D2", "A3", "e2", "V2", "d2", "S2", "s2", "I2",
        # Driver Variables
        "Driver_C1", "Driver_C2", "Driver_N1", "Driver_N2",
        "Driver_E1", "Driver_E2", "Driver_B1", "Driver_A3"
    ]

    # Regex to extract the list of numbers from the array1d structure
    pattern = re.compile(r'\[(.*?)\]')
    data = []

    for line in output_string.split('----------'):
        match = pattern.search(line)
        if match:
            # Clean up the string and convert to list of integers
            values_str = match.group(1).replace(' ', '').split(',')
            if len(values_str) == len(column_names):
                # Ensure all elements can be converted to integer before appending
                try:
                    data.append([int(v) for v in values_str])
                except ValueError:
                    # Skip lines that do not contain valid integer data (e.g., the last empty line)
                    continue

    return pd.DataFrame(data, columns=column_names)

def format_output(df):
    """Formats the DataFrame for display as a plain text string table."""
    
    # 1. Separate the three types of variables
    score_cols = ["Total_Violations", "Structural_Violations", "User_Violations"]
    driver_cols = [col for col in df.columns if col.startswith("Driver_")]
    context_cols = [col for col in df.columns if col not in score_cols and col not in driver_cols]
    
    # Reorder columns for logical grouping
    df_display = df[driver_cols + context_cols + score_cols]
    
    # 2. Convert 1/0 to TRUE/FALSE for readability in the main context variables
    # We must operate on a copy of the slice to avoid SettingWithCopyWarning
    df_display = df_display.copy() 
    for col in context_cols:
        df_display[col] = df_display[col].apply(lambda x: 'TRUE' if x == 1 else 'FALSE')

    # Convert the resulting DataFrame to a plain text string table (no external dependency needed)
    text_table = df_display.to_string(index=True)
    
    return text_table

# ----------------- Execution -----------------
try:
    results_df = parse_mzn_output(mzn_output)
    
    # If there are no results, inform the user
    if results_df.empty:
        print("No solutions were parsed from the MiniZinc output.")
    else:
        markdown_results = format_output(results_df)

        print(f"I successfully parsed {len(results_df)} optimal solutions.\n")
        print("## Optimal System States (Total Violations = 20)")
        print("This table shows the 18 driver combinations (inputs) that resulted in the lowest possible violation score (20), with **TRUE** meaning the variable is active.")
        print("\n" + markdown_results)
        print("\n\nAnalysis note: The constant score of 20 means that 10 soft user constraints (1-point cost) and 1 hard structural constraint (10-point cost) were violated in every single one of these 18 optimal states.")

except Exception as e:
    # Print the error but don't stop the program (though this is less likely now)
    print(f"An unexpected error occurred during parsing: {e}")
