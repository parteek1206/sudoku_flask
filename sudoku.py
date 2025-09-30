# sudoku.py
import numpy as np
import random
import copy

def generate_sudoku():
    board = np.zeros((9,9), dtype=int)
    fill_board(board)
    return board

def fill_board(board):
    for i in range(9):
        for j in range(9):
            if board[i][j] == 0:
                numbers = list(range(1,10))
                random.shuffle(numbers)
                for num in numbers:
                    if is_valid(board, i, j, num):
                        board[i][j] = num
                        if fill_board(board):
                            return True
                        board[i][j] = 0
                return False
    return True

def remove_numbers(board, level=30):
    puzzle = board.copy()
    count = 0
    # Remove random unique positions
    positions = [(i,j) for i in range(9) for j in range(9)]
    random.shuffle(positions)
    for (i,j) in positions:
        if count >= level:
            break
        if puzzle[i][j] != 0:
            backup = puzzle[i][j]
            puzzle[i][j] = 0
            # Optionally ensure uniqueness of solution — skipped for speed
            count += 1
    return puzzle

def is_valid(board, row, col, num):
    if num in board[row, :]:
        return False
    if num in board[:, col]:
        return False
    start_row, start_col = 3*(row//3), 3*(col//3)
    if num in board[start_row:start_row+3, start_col:start_col+3]:
        return False
    return True

def solve(board):
    # board: numpy array mutates to solution if solvable
    for i in range(9):
        for j in range(9):
            if board[i][j] == 0:
                for num in range(1, 10):
                    if is_valid(board, i, j, num):
                        board[i][j] = num
                        if solve(board):
                            return True
                        board[i][j] = 0
                return False
    return True

def get_solution(board):
    b = board.copy()
    if solve(b):
        return b
    return None

def provide_hint(puzzle_board):
    # puzzle_board numpy array with zeros for empty.
    solution = get_solution(puzzle_board)
    if solution is None:
        return None
    empties = [(i,j) for i in range(9) for j in range(9) if puzzle_board[i][j]==0]
    if not empties:
        return None
    i,j = random.choice(empties)
    return (int(i), int(j), int(solution[i][j]))
