import numpy as np
from scipy import linalg
from scipy.linalg import rq


def factorize_projection_matrix(P):
    '''
        factorize a 3x4 projection matrix P to K, R, t
        P: [3, 4]; numpy array

        return:
            K: [3, 3]; numpy array
            R: [3, 3]; numpy array
            t: [3, ]; numpy array
    '''
    K, R = linalg.rq(P[:, :3])
    t = linalg.lstsq(K, P[:, 3:4])[0]

    # Fix the intrinsic and rotation matrices.
    # Intrinsic diagonal entries must be positive, and det(R) must be 1.
    neg_sign_cnt = int(K[0, 0] < 0) + int(K[1, 1] < 0) + int(K[2, 2] < 0)
    if neg_sign_cnt == 1 or neg_sign_cnt == 3:
        K = -K

    new_neg_sign_cnt = int(K[0, 0] < 0) + int(K[1, 1] < 0) + int(K[2, 2] < 0)
    assert (new_neg_sign_cnt == 0 or new_neg_sign_cnt == 2)

    fix = np.diag((1, 1, 1))
    if K[0, 0] < 0 and K[1, 1] < 0:
        fix = np.diag((-1, -1, 1))
    elif K[0, 0] < 0 and K[2, 2] < 0:
        fix = np.diag((-1, 1, -1))
    elif K[1, 1] < 0 and K[2, 2] < 0:
        fix = np.diag((1, -1, -1))
    K = np.matmul(K, fix)
    R = np.matmul(fix, R)
    t = np.matmul(fix, t).reshape((-1,))

    assert (linalg.det(R) > 0)
    K /= K[2, 2]

    return K, R, t


def enforce_orthogonality(K):
    """
    Force the camera intrinsic matrix to have orthogonal x/y axes by removing skew.
    """
    K_fixed = K.copy()
    K_fixed[0, 1] = 0
    return K_fixed


def factorize_projection_matrix2(P):
    '''
        Decompose a 3x4 projection matrix P into K, R, and t, then force K's
        x/y axes to be orthogonal.

        P: [3, 4]; numpy array

        return:
            K: [3, 3]; orthogonalized intrinsic matrix
            R: [3, 3]; rotation matrix
            t: [3,]; translation vector
    '''
    K, R = rq(P[:, :3])

    # Ensure positive diagonal values in K.
    fix = np.diag(np.sign(np.diag(K)))
    K = K @ fix
    R = fix @ R

    # Use inv here to keep the translation computation explicit.
    t = np.linalg.inv(K) @ P[:, 3]

    K_orthogonal = enforce_orthogonality(K)

    # Recompute R so the new K * R still approximates P[:, :3].
    R_new = np.linalg.inv(K_orthogonal) @ P[:, :3]

    # Re-orthogonalize R with SVD and keep det(R) positive.
    U, _, Vt = np.linalg.svd(R_new)
    R_new = U @ Vt

    t_new = np.linalg.inv(K_orthogonal) @ P[:, 3]
    K_orthogonal /= K_orthogonal[2, 2]

    if np.linalg.det(R_new) < 0:
        R_new *= -1
        t_new *= -1

    return K_orthogonal, R_new, t_new
