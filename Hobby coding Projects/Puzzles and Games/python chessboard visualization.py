class Chessboard:
    def __init__(self):
        # Initialize an 8x8 board
        self.board = self.create_initial_board()
        
    def create_initial_board(self):
        # Set up the board with pieces in their initial positions
        initial_board = [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],  # Black pieces
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],  # Black pawns
            ['.', '.', '.', '.', '.', '.', '.', '.'],  # Empty spaces
            ['.', '.', '.', '.', '.', '.', '.', '.'],
            ['.', '.', '.', '.', '.', '.', '.', '.'],
            ['.', '.', '.', '.', '.', '.', '.', '.'],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],  # White pawns
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']   # White pieces
        ]
        return initial_board

    def display(self):
        # Display the chessboard
        for row in self.board:
            print(" ".join(row))
        print("\n")

    def make_move(self, start_pos, end_pos):
        # Convert positions like 'e2' into row/col indices
        start_row, start_col = self.position_to_indices(start_pos)
        end_row, end_col = self.position_to_indices(end_pos)
        
        # Check if the move is valid (for simplicity, we skip actual validation)
        piece = self.board[start_row][start_col]
        self.board[end_row][end_col] = piece
        self.board[start_row][start_col] = '.'

    def position_to_indices(self, pos):
        # Convert chess notation like 'e2' to row/col indices (0-indexed)
        column_mapping = {'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5, 'g': 6, 'h': 7}
        row = 8 - int(pos[1])  # Rows are numbered 1-8, but we store them 0-7
        col = column_mapping[pos[0].lower()]
        return row, col


import pygame

# Initialize pygame
pygame.init()

# Set up the display
WIDTH, HEIGHT = 600, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Chess Visualization")

# Define colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
LIGHT_BROWN = (222, 184, 135)
DARK_BROWN = (139, 69, 19)

# Create a function to draw the board
def draw_board():
    for row in range(8):
        for col in range(8):
            color = LIGHT_BROWN if (row + col) % 2 == 0 else DARK_BROWN
            pygame.draw.rect(screen, color, (col * 75, row * 75, 75, 75))
            # Optionally, draw pieces as images or characters
            piece = chessboard.board[row][col]
            if piece != '.':
                font = pygame.font.SysFont(None, 48)
                text = font.render(piece, True, WHITE if piece.isupper() else BLACK)
                screen.blit(text, (col * 75 + 20, row * 75 + 20))

# Run the game loop
chessboard = Chessboard()  # Assuming you have a chessboard class
while True:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            exit()
    screen.fill(BLACK)
    draw_board()
    pygame.display.update()
